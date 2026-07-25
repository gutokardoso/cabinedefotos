import OpenAI, { toFile } from "openai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "15mb"
    }
  },
  maxDuration: 300
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function parseDataUrl(value) {
  if (typeof value !== "string") return null;

  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");

  if (!ALLOWED_TYPES.has(mimeType) || !buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    return null;
  }

  return { mimeType, buffer };
}

function extensionFor(mimeType) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método não permitido." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return response.status(503).json({
      error: "A chave OPENAI_API_KEY ainda não foi configurada no Vercel."
    });
  }

  const parsedImage = parseDataUrl(request.body?.image);

  if (!parsedImage) {
    return response.status(400).json({
      error: "Imagem inválida. Envie JPEG, PNG ou WebP com até 10 MB."
    });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const sourceImage = await toFile(
      parsedImage.buffer,
      `foto-jogador.${extensionFor(parsedImage.mimeType)}`,
      { type: parsedImage.mimeType }
    );

    const prompt = `
Crie uma nova imagem vertical usando a pessoa da foto de referência como personagem principal.

Transforme a pessoa em um personagem ORIGINAL de animação 3D cinematográfica, simpático, premium e expressivo. Não copie nem imite personagens, franquias, estúdios ou marcas existentes.

PRESERVE COM ALTA FIDELIDADE:
- identidade reconhecível e fisionomia do rosto;
- formato do rosto, olhos, sobrancelhas, nariz, boca e sorriso;
- tom de pele, idade aparente e características físicas;
- cabelo, penteado, textura e cor;
- roupas, cores, estampas, acessórios e calçados;
- pose, enquadramento e proporções da pessoa sempre que visíveis.

DIREÇÃO VISUAL:
- acabamento de longa-metragem de animação 3D;
- iluminação cinematográfica suave;
- texturas refinadas e aparência profissional;
- personagem centralizado, com boa separação do fundo;
- fundo simples, limpo e neutro, sem textos, logotipos ou marcas;
- apenas uma pessoa;
- não inventar objetos, acessórios ou roupas.

A pessoa deve continuar claramente reconhecível como a mesma pessoa da fotografia original.
`.trim();

    const result = await openai.images.edit({
      model: "gpt-image-2",
      image: sourceImage,
      prompt,
      size: "1024x1536",
      quality: "medium",
      output_format: "jpeg",
      output_compression: 88
    });

    const generatedBase64 = result.data?.[0]?.b64_json;

    if (!generatedBase64) {
      throw new Error("A OpenAI não retornou dados de imagem.");
    }

    return response.status(200).json({
      image: `data:image/jpeg;base64,${generatedBase64}`
    });
  } catch (error) {
    console.error("Erro ao transformar imagem:", error);

    const status = Number.isInteger(error?.status) ? error.status : 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;

    return response.status(safeStatus).json({
      error:
        error?.code === "moderation_blocked"
          ? "A imagem não pôde ser processada pelas regras de segurança. Tente outra foto."
          : "Não foi possível gerar o personagem neste momento.",
      code: error?.code || "image_generation_failed"
    });
  }
}
