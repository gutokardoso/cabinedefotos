import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const { generationId, name, phone, email, consent } = await req.json();
    if (!generationId || !name || !phone || !email) {
      return json({ error: "Preencha todos os campos obrigatórios." }, 400);
    }
    if (!validEmail(email)) return json({ error: "Informe um e-mail válido." }, 400);
    if (!consent) return json({ error: "É necessário autorizar o envio da imagem." }, 400);

    const { data: generation, error: generationError } = await supabase
      .from("avatar_generations")
      .select("id, generated_path, status")
      .eq("id", generationId)
      .single();
    if (generationError || !generation || generation.status !== "ready") {
      return json({ error: "A imagem informada não está disponível." }, 404);
    }

    const { data: imageBlob, error: downloadError } = await supabase.storage
      .from("avatar-images")
      .download(generation.generated_path);
    if (downloadError || !imageBlob) throw downloadError || new Error("Imagem não encontrada.");

    const bytes = new Uint8Array(await imageBlob.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const attachmentBase64 = btoa(binary);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const emailFrom = Deno.env.get("EMAIL_FROM");
    if (!resendKey || !emailFrom) {
      throw new Error("RESEND_API_KEY ou EMAIL_FROM não configurados.");
    }

    const { data: lead, error: leadError } = await supabase
      .from("avatar_leads")
      .insert({
        generation_id: generationId,
        name: String(name).trim().slice(0, 120),
        phone: String(phone).trim().slice(0, 40),
        email: String(email).trim().toLowerCase().slice(0, 180),
        consent: true,
        email_status: "sending",
      })
      .select("id")
      .single();
    if (leadError) throw leadError;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [email],
        subject: "Seu personagem ficou pronto!",
        html: `
          <div style="font-family:Arial,sans-serif;background:#f4f6fb;padding:32px">
            <div style="max-width:560px;margin:auto;background:white;border-radius:18px;padding:28px">
              <h1 style="margin:0 0 14px;color:#111827">Olá, ${String(name).replace(/[<>]/g, "")}!</h1>
              <p style="font-size:16px;line-height:1.6;color:#374151">Seu personagem criado na experiência interativa está anexado a este e-mail.</p>
              <p style="font-size:13px;color:#6b7280">Obrigado por participar.</p>
            </div>
          </div>`,
        attachments: [{
          filename: "meu-personagem.jpg",
          content: attachmentBase64,
        }],
      }),
    });

    const emailPayload = await emailResponse.json();
    if (!emailResponse.ok) {
      await supabase.from("avatar_leads").update({
        email_status: "failed",
        email_error: emailPayload?.message || "Falha no serviço de e-mail",
      }).eq("id", lead.id);
      throw new Error(emailPayload?.message || "O e-mail não pôde ser enviado.");
    }

    await supabase.from("avatar_leads").update({
      email_status: "sent",
      email_provider_id: emailPayload.id || null,
      emailed_at: new Date().toISOString(),
    }).eq("id", lead.id);

    return json({ message: "Cadastro salvo e imagem enviada para o e-mail informado!" });
  } catch (error) {
    console.error(error);
    return json({ error: (error instanceof Error ? error.message : "Não foi possível enviar a imagem.") }, 500);
  }
});
