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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const { password } = await req.json();
    const expected = Deno.env.get("ADMIN_PASSWORD");
    if (!expected || password !== expected) return json({ error: "Senha administrativa inválida." }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabase
      .from("avatar_leads")
      .select("id, created_at, name, phone, email, email_status, avatar_generations(generated_path)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;

    const records = await Promise.all((data || []).map(async (item: any) => {
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
        imageUrl,
      };
    }));

    return json({ records });
  } catch (error) {
    console.error(error);
    return json({ error: (error instanceof Error ? error.message : "Não foi possível carregar os cadastros.") }, 500);
  }
});
