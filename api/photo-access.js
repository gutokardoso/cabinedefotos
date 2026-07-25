import { getSupabaseAdmin, sendJson } from "./_helpers.js";

const SIGNED_URL_SECONDS = 60 * 10;

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { error: "Método não permitido." });
  }

  const token = typeof request.query?.t === "string" ? request.query.t.trim() : "";
  if (!token || token.length > 128) return sendJson(response, 400, { error: "Link inválido." });

  const supabase = getSupabaseAdmin();

  try {
    const { data: lead, error: leadError } = await supabase
      .from("avatar_leads")
      .select("generation_id, delivery_expires_at")
      .eq("delivery_token", token)
      .single();

    if (leadError || !lead) return sendJson(response, 404, { error: "Este link não foi encontrado." });
    if (!lead.delivery_expires_at || new Date(lead.delivery_expires_at).getTime() <= Date.now()) {
      return sendJson(response, 410, { error: "Este link expirou." });
    }

    const { data: generation, error: generationError } = await supabase
      .from("avatar_generations")
      .select("id, generated_path, status")
      .eq("id", lead.generation_id)
      .single();

    if (generationError || !generation || generation.status !== "ready" || !generation.generated_path) {
      return sendJson(response, 404, { error: "A imagem não está mais disponível." });
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from("avatar-images")
      .createSignedUrl(generation.generated_path, SIGNED_URL_SECONDS);

    if (signedError || !signed?.signedUrl) {
      throw signedError || new Error("Não foi possível abrir a imagem.");
    }

    response.setHeader("Cache-Control", "private, no-store");
    return sendJson(response, 200, {
      imageUrl: signed.signedUrl,
      fileName: `personagem-${generation.id}.jpg`,
      expiresAt: lead.delivery_expires_at
    });
  } catch (error) {
    console.error("photo-access:", error);
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Não foi possível abrir a imagem."
    });
  }
}
