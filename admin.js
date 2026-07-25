(() => {
  "use strict";
  const cfg = window.GAME_CONFIG || {};
  const status = document.getElementById("adminStatus");
  const rows = document.getElementById("adminRows");
  const tableWrap = document.getElementById("tableWrap");
  const actions = document.getElementById("adminActions");
  let records = [];

  async function loadData() {
    const password = document.getElementById("adminPassword").value;
    if (!password) return void (status.textContent = "Informe a senha administrativa.");
    status.textContent = "Carregando cadastros...";

    try {
      const base = String(cfg.supabaseUrl || "").replace(/\/$/, "");
      const response = await fetch(`${base}/functions/v1/admin-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: cfg.supabaseAnonKey,
          Authorization: `Bearer ${cfg.supabaseAnonKey}`
        },
        body: JSON.stringify({ password })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível acessar os dados.");
      records = payload.records || [];
      render();
      status.textContent = `${records.length} cadastro(s) encontrado(s).`;
      tableWrap.classList.remove("hidden");
      actions.classList.remove("hidden");
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function render() {
    rows.innerHTML = records.map((item) => `
      <tr>
        <td>${item.imageUrl ? `<a href="${item.imageUrl}" target="_blank" rel="noopener"><img class="thumb" src="${item.imageUrl}" alt="Avatar"></a>` : "—"}</td>
        <td>${new Date(item.createdAt).toLocaleString("pt-BR")}</td>
        <td>${escapeHtml(item.name || "")}</td>
        <td>${escapeHtml(item.phone || "")}</td>
        <td>${escapeHtml(item.email || "")}</td>
        <td>${escapeHtml(item.emailStatus || "")}</td>
      </tr>`).join("");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  }

  function exportCsv() {
    if (!records.length) return;
    const data = [["data","nome","telefone","email","status_email","imagem"], ...records.map((r) => [r.createdAt,r.name,r.phone,r.email,r.emailStatus,r.imageUrl])];
    const csv = data.map((row) => row.map((v) => `"${String(v || "").replaceAll('"','""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leads-avatar-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  document.getElementById("loadButton").addEventListener("click", loadData);
  document.getElementById("refreshButton").addEventListener("click", loadData);
  document.getElementById("exportButton").addEventListener("click", exportCsv);
  document.getElementById("adminPassword").addEventListener("keydown", (e) => { if (e.key === "Enter") loadData(); });
})();
