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

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) throw new Error("Formato de imagem inválido.");
  const mime = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, mime };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return json({ error: "OPENAI_API_KEY não configurada no Supabase." }, 500);

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });

  let generationId = "";

  try {
    const payload = await req.json();
    if (!payload.image || typeof payload.image !== "string") {
      return json({ error: "Nenhuma fotografia foi enviada." }, 400);
    }

    const original = parseDataUrl(payload.image);
    if (original.bytes.byteLength > 8 * 1024 * 1024) {
      return json({ error: "A fotografia ultrapassa o limite de 8 MB." }, 413);
    }

    generationId = crypto.randomUUID();
    const originalPath = `${generationId}/original.jpg`;
    const generatedPath = `${generationId}/avatar.jpg`;

    const { error: originalUploadError } = await supabase.storage
      .from("avatar-images")
      .upload(originalPath, original.bytes, {
        contentType: original.mime,
        upsert: false,
      });
    if (originalUploadError) throw originalUploadError;

    const { error: insertError } = await supabase.from("avatar_generations").insert({
      id: generationId,
      original_path: originalPath,
      status: "processing",
    });
    if (insertError) throw insertError;

    const form = new FormData();
    form.append("model", "gpt-image-2");
    form.append("image", new Blob([original.bytes], { type: original.mime }), "foto.jpg");
    form.append("size", "1024x1536");
    form.append("quality", "medium");
    form.append("output_format", "jpeg");
    form.append("prompt", `
Transforme a pessoa desta fotografia em um personagem original de animação 3D cinematográfica premium.
Preserve com máxima fidelidade a identidade e os traços reconhecíveis: formato do rosto, olhos, nariz, boca, tom de pele, cabelo, penteado, expressão, roupas, cores, estampas, acessórios, pose e proporções corporais.
Mantenha a mesma pessoa e a mesma roupa. Não altere idade aparente, gênero, etnia ou características físicas.
Não copie personagens, franquias, estúdios ou marcas existentes. Não adicione textos, logotipos ou objetos ausentes na foto.
Produza composição vertical, personagem centralizado, acabamento expressivo de longa-metragem 3D e fundo neutro discreto.
    `.trim());

    const aiResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });

    const aiPayload = await aiResponse.json();
    if (!aiResponse.ok) {
      throw new Error(aiPayload?.error?.message || "A API de imagem recusou a solicitação.");
    }

    const generatedBase64 = aiPayload?.data?.[0]?.b64_json;
    if (!generatedBase64) throw new Error("A API não retornou a imagem gerada.");

    const generatedBinary = atob(generatedBase64);
    const generatedBytes = new Uint8Array(generatedBinary.length);
    for (let i = 0; i < generatedBinary.length; i++) generatedBytes[i] = generatedBinary.charCodeAt(i);

    const { error: generatedUploadError } = await supabase.storage
      .from("avatar-images")
      .upload(generatedPath, generatedBytes, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (generatedUploadError) throw generatedUploadError;

    const { error: updateError } = await supabase
      .from("avatar_generations")
      .update({ generated_path: generatedPath, status: "ready" })
      .eq("id", generationId);
    if (updateError) throw updateError;

    return json({
      generationId,
      image: `data:image/jpeg;base64,${generatedBase64}`,
    });
  } catch (error) {
    console.error(error);
    if (generationId) {
      await supabase
        .from("avatar_generations")
        .update({ status: "failed", error_message: String((error instanceof Error ? error.message : String(error))).slice(0, 500) })
        .eq("id", generationId);
    }
    return json({ error: (error instanceof Error ? error.message : "Não foi possível gerar o personagem.") }, 500);
  }
});
