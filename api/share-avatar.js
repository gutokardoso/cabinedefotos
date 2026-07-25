import { getSupabaseAdmin, requirePost, safeText, sendJson, validEmail } from "./_helpers.js";

export default async function handler(request, response) {
  if (!requirePost(request, response)) return;
  const supabase = getSupabaseAdmin();

  try {
    const generationId = safeText(request.body?.generationId, 80);
    const name = safeText(request.body?.name, 120);
    const phone = safeText(request.body?.phone, 40);
    const email = safeText(request.body?.email, 180).toLowerCase();
    const consent = request.body?.consent === true;

    if (!generationId || !name || !phone || !email) {
      return sendJson(response, 400, { error: "Preencha todos os campos obrigatórios." });
    }
    if (!validEmail(email)) return sendJson(response, 400, { error: "Informe um e-mail válido." });
    if (!consent) return sendJson(response, 400, { error: "É necessário autorizar o envio da imagem." });

    const { data: generation, error: generationError } = await supabase
      .from("avatar_generations")
      .select("id, generated_path, status")
      .eq("id", generationId)
      .single();
    if (generationError || !generation || generation.status !== "ready") {
      return sendJson(response, 404, { error: "A imagem informada não está disponível." });
    }

    const { data: imageBlob, error: downloadError } = await supabase.storage
      .from("avatar-images")
      .download(generation.generated_path);
    if (downloadError || !imageBlob) throw downloadError || new Error("Imagem não encontrada.");
    const attachmentBase64 = Buffer.from(await imageBlob.arrayBuffer()).toString("base64");

    const { data: lead, error: leadError } = await supabase
      .from("avatar_leads")
      .insert({
        generation_id: generationId,
        name,
        phone,
        email,
        consent: true,
        email_status: "sending"
      })
      .select("id")
      .single();
    if (leadError) throw leadError;

    const resendKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM;
    if (!resendKey || !emailFrom) {
      await supabase.from("avatar_leads").update({
        email_status: "failed",
        email_error: "RESEND_API_KEY ou EMAIL_FROM não configurados no Vercel."
      }).eq("id", lead.id);
      throw new Error("O cadastro foi salvo, mas o envio de e-mail ainda não foi configurado.");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: emailFrom,
        to: [email],
        subject: "Seu personagem ficou pronto!",
        html: `<div style="font-family:Arial,sans-serif;background:#f4f6fb;padding:32px"><div style="max-width:560px;margin:auto;background:white;border-radius:18px;padding:28px"><h1 style="margin:0 0 14px;color:#111827">Olá, ${name.replace(/[<>]/g, "")}!</h1><p style="font-size:16px;line-height:1.6;color:#374151">Seu personagem criado na experiência interativa está anexado a este e-mail.</p><p style="font-size:13px;color:#6b7280">Obrigado por participar.</p></div></div>`,
        attachments: [{ filename: "meu-personagem.jpg", content: attachmentBase64 }]
      })
    });

    const emailPayload = await emailResponse.json().catch(() => ({}));
    if (!emailResponse.ok) {
      await supabase.from("avatar_leads").update({
        email_status: "failed",
        email_error: emailPayload?.message || `Erro ${emailResponse.status}`
      }).eq("id", lead.id);
      throw new Error(emailPayload?.message || "O e-mail não pôde ser enviado.");
    }

    await supabase.from("avatar_leads").update({
      email_status: "sent",
      email_provider_id: emailPayload.id || null,
      emailed_at: new Date().toISOString()
    }).eq("id", lead.id);

    return sendJson(response, 200, { message: "Cadastro salvo e imagem enviada para o e-mail informado!" });
  } catch (error) {
    console.error("share-avatar:", error);
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Não foi possível enviar a imagem."
    });
  }
}
