import { createClient } from "@supabase/supabase-js";

export function sendJson(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  return response.end(JSON.stringify(body));
}

export function requirePost(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Método não permitido." });
    return false;
  }
  return true;
}

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurada no Vercel.");
  }
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") throw new Error("Nenhuma fotografia foi enviada.");
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) throw new Error("Formato de imagem inválido.");
  const mime = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const buffer = Buffer.from(match[2], "base64");
  const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return { buffer, mime, extension };
}

export function safeText(value, maxLength = 180) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}
