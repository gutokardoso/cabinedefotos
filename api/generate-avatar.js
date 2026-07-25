import { Blob } from "node:buffer";
import path from "node:path";
import sharp from "sharp";
import { getSupabaseAdmin, parseDataUrl, requirePost, sendJson } from "./_helpers.js";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default async function handler(request, response) {
  if (!requirePost(request, response)) return;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return sendJson(response, 500, { error: "OPENAI_API_KEY não configurada no Vercel." });
  }

  const supabase = getSupabaseAdmin();
  let generationId = "";

  try {
    const original = parseDataUrl(request.body?.image);
    if (original.buffer.length > 3.5 * 1024 * 1024) {
      return sendJson(response, 413, { error: "A fotografia ficou muito grande. Tire outra foto mais próxima." });
    }

    generationId = crypto.randomUUID();
    const originalPath = `${generationId}/original.${original.extension}`;
    const generatedPath = `${generationId}/avatar.png`;

    const { error: originalUploadError } = await supabase.storage
      .from("avatar-images")
      .upload(originalPath, original.buffer, { contentType: original.mime, upsert: false });
    if (originalUploadError) throw originalUploadError;

    const { error: insertError } = await supabase.from("avatar_generations").insert({
      id: generationId,
      original_path: originalPath,
      status: "processing"
    });
    if (insertError) throw insertError;

    const form = new FormData();
    form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-2");
    form.append("image", new Blob([original.buffer], { type: original.mime }), `foto.${original.extension}`);
    form.append("size", "1024x1536");
    form.append("quality", process.env.OPENAI_IMAGE_QUALITY || "medium");
    form.append("output_format", "png");
    form.append("prompt", `
Transforme exclusivamente a pessoa desta fotografia em um personagem original de longa-metragem de animação 3D cinematográfica, com visual encantador, polido e expressivo semelhante à referência fornecida pelo cliente: olhos levemente maiores e expressivos, formas faciais suaves, pele com acabamento 3D delicado, cabelo detalhado, iluminação cinematográfica suave e qualidade premium de filme animado.
Preserve com máxima fidelidade a identidade e os traços reconhecíveis da pessoa: formato do rosto, olhos, nariz, boca, tom de pele, cabelo, penteado, expressão, roupas, cores, estampas, acessórios, pose e proporções corporais.
Mantenha a mesma pessoa e a mesma roupa. Não altere idade aparente, gênero, etnia ou características físicas. Não transforme a pessoa em outra identidade.
Gere somente o personagem centralizado em retrato vertical sobre um fundo chroma key verde puro, plano e uniforme na cor exata #00FF00. O verde deve ocupar todo o fundo, sem gradiente, textura, cenário, chão, objetos ou sombras projetadas. Não use verde nas roupas, acessórios, olhos ou cabelo. Não crie moldura, texto, logotipo ou assinatura.
Mantenha espaço visual adequado ao redor da cabeça e enquadre o personagem do peito ou cintura para cima, sem cortar o topo do cabelo.
    `.trim());

    const aiResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form
    });

    const aiPayload = await aiResponse.json().catch(() => ({}));
    if (!aiResponse.ok) {
      throw new Error(aiPayload?.error?.message || `A API de imagem retornou erro ${aiResponse.status}.`);
    }

    const generatedBase64 = aiPayload?.data?.[0]?.b64_json;
    if (!generatedBase64) throw new Error("A API não retornou a imagem gerada.");
    const characterBuffer = Buffer.from(generatedBase64, "base64");

    const assetsDirectory = path.join(process.cwd(), "assets");
    const backgroundPath = path.join(assetsDirectory, "avatar-background.png");
    const foregroundPath = path.join(assetsDirectory, "avatar-foreground.png");

    // O modelo atual não aceita saída transparente. A IA produz o personagem
    // sobre chroma key verde e o servidor converte esse verde em transparência.
    const resizedCharacter = await sharp(characterBuffer)
      .resize(1024, 1536, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data: rawPixels, info } = resizedCharacter;
    const rgbaPixels = Buffer.alloc(info.width * info.height * 4);

    for (let source = 0, target = 0; source < rawPixels.length; source += 3, target += 4) {
      const red = rawPixels[source];
      const green = rawPixels[source + 1];
      const blue = rawPixels[source + 2];

      // Remove verdes intensos e suaviza as bordas para evitar halo.
      const greenDominance = green - Math.max(red, blue);
      const greenStrength = green / 255;
      let alpha = 255;

      if (greenDominance > 80 && greenStrength > 0.55) {
        alpha = 0;
      } else if (greenDominance > 25 && greenStrength > 0.35) {
        alpha = Math.max(0, Math.min(255, Math.round(255 * (80 - greenDominance) / 55)));
      }

      // Reduz contaminação verde nas bordas sem alterar áreas opacas.
      const correctedGreen = alpha < 255
        ? Math.min(green, Math.max(red, blue) + 18)
        : green;

      rgbaPixels[target] = red;
      rgbaPixels[target + 1] = correctedGreen;
      rgbaPixels[target + 2] = blue;
      rgbaPixels[target + 3] = alpha;
    }

    const preparedCharacter = await sharp(rgbaPixels, {
      raw: { width: info.width, height: info.height, channels: 4 }
    })
      .png()
      .toBuffer();

    const finalImageBuffer = await sharp(backgroundPath)
      .resize(1024, 1536, { fit: "fill" })
      .composite([
        { input: preparedCharacter, left: 0, top: 0 },
        { input: foregroundPath, left: 0, top: 0 }
      ])
      .png({ compressionLevel: 9 })
      .toBuffer();

    const { error: generatedUploadError } = await supabase.storage
      .from("avatar-images")
      .upload(generatedPath, finalImageBuffer, { contentType: "image/png", upsert: false });
    if (generatedUploadError) throw generatedUploadError;

    const { error: updateError } = await supabase
      .from("avatar_generations")
      .update({ generated_path: generatedPath, status: "ready" })
      .eq("id", generationId);
    if (updateError) throw updateError;

    const { data: signed, error: signedError } = await supabase.storage
      .from("avatar-images")
      .createSignedUrl(generatedPath, 60 * 60);
    if (signedError || !signed?.signedUrl) throw signedError || new Error("Não foi possível abrir a imagem gerada.");

    return sendJson(response, 200, { generationId, imageUrl: signed.signedUrl });
  } catch (error) {
    console.error("generate-avatar:", error);
    if (generationId) {
      await supabase.from("avatar_generations").update({
        status: "failed",
        error_message: String(error instanceof Error ? error.message : error).slice(0, 500)
      }).eq("id", generationId);
    }
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Não foi possível gerar o personagem."
    });
  }
}
