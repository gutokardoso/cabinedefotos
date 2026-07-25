import { getSupabaseAdmin, requirePost, sendJson } from "./_helpers.js";

export default async function handler(request, response) {
  if (!requirePost(request, response)) return;

  try {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected || request.body?.password !== expected) {
      return sendJson(response, 401, { error: "Senha administrativa inválida." });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("avatar_leads")
      .select("id, created_at, name, phone, email, email_status, avatar_generations(generated_path)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;

    const records = await Promise.all((data || []).map(async (item) => {
      const path = item.avatar_generations?.generated_path;
      let imageUrl = "";
      if (path) {
        const { data: signed } = await supabase.storage.from("avatar-images").createSignedUrl(path, 3600);
        imageUrl = signed?.signedUrl || "";
      }
      return {
        id: item.id,
        createdAt: item.created_at,
        name: item.name,
        phone: item.phone,
        email: item.email,
        emailStatus: item.email_status,
        imageUrl
      };
    }));

    return sendJson(response, 200, { records });
  } catch (error) {
    console.error("admin-data:", error);
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Não foi possível carregar os cadastros."
    });
  }
}
