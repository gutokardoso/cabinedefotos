import QRCode from "qrcode";
import { getSupabaseAdmin, requirePost, safeText, sendJson, validEmail } from "./_helpers.js";

const LINK_EXPIRATION_SECONDS = 60 * 60 * 24 * 30;

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
    if (!consent) return sendJson(response, 400, { error: "É necessário autorizar o cadastro e a disponibilização da imagem." });

    const { data: generation, error: generationError } = await supabase
      .from("avatar_generations")
      .select("id, generated_path, status")
      .eq("id", generationId)
      .single();

    if (generationError || !generation || generation.status !== "ready" || !generation.generated_path) {
      return sendJson(response, 404, { error: "A imagem informada não está disponível." });
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from("avatar-images")
      .createSignedUrl(generation.generated_path, LINK_EXPIRATION_SECONDS, {
        download: `personagem-${generationId}.jpg`
      });

    if (signedError || !signed?.signedUrl) {
      throw signedError || new Error("Não foi possível criar o link seguro da imagem.");
    }

    const { error: leadError } = await supabase
      .from("avatar_leads")
      .insert({
        generation_id: generationId,
        name,
        phone,
        email,
        consent: true,
        email_status: "pending",
        email_error: "Entrega por QR Code/link seguro — sem envio automático de e-mail."
      });

    if (leadError) throw leadError;

    const qrCode = await QRCode.toDataURL(signed.signedUrl, {
      errorCorrectionLevel: "M",
      width: 640,
      margin: 2
    });

    return sendJson(response, 200, {
      message: "Cadastro salvo. Escaneie o QR Code ou abra o link para baixar sua imagem.",
      downloadUrl: signed.signedUrl,
      qrCode,
      expiresInDays: 30
    });
  } catch (error) {
    console.error("share-avatar:", error);
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Não foi possível disponibilizar a imagem."
    });
  }
}
