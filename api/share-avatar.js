import crypto from "node:crypto";
import QRCode from "qrcode";
import { getSupabaseAdmin, requirePost, safeText, sendJson, validEmail } from "./_helpers.js";

const LINK_EXPIRATION_DAYS = 30;

function requestOrigin(request) {
  const forwardedProto = request.headers["x-forwarded-proto"] || "https";
  const forwardedHost = request.headers["x-forwarded-host"] || request.headers.host;
  if (!forwardedHost) throw new Error("Não foi possível identificar o endereço público do projeto.");
  return `${forwardedProto}://${forwardedHost}`;
}

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

    const accessToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + LINK_EXPIRATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { error: leadError } = await supabase
      .from("avatar_leads")
      .insert({
        generation_id: generationId,
        name,
        phone,
        email,
        consent: true,
        email_status: "pending",
        email_error: "Entrega por QR Code e página mobile segura.",
        delivery_token: accessToken,
        delivery_expires_at: expiresAt
      });

    if (leadError) throw leadError;

    const mobilePageUrl = `${requestOrigin(request)}/foto.html?t=${encodeURIComponent(accessToken)}`;
    const qrCode = await QRCode.toDataURL(mobilePageUrl, {
      errorCorrectionLevel: "M",
      width: 640,
      margin: 2
    });

    return sendJson(response, 200, {
      message: "Cadastro salvo. Escaneie o QR Code com o celular para abrir sua foto e salvá-la na galeria.",
      downloadUrl: mobilePageUrl,
      qrCode,
      expiresInDays: LINK_EXPIRATION_DAYS
    });
  } catch (error) {
    console.error("share-avatar:", error);
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Não foi possível disponibilizar a imagem."
    });
  }
}
