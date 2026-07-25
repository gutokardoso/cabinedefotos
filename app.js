(() => {
  "use strict";

  const config = window.GAME_CONFIG || {};
  const screens = [...document.querySelectorAll(".screen")];
  const video = document.getElementById("cameraVideo");
  const canvas = document.getElementById("captureCanvas");
  const resultImage = document.getElementById("resultImage");
  const dialog = document.getElementById("leadDialog");
  const form = document.getElementById("leadForm");
  const formStatus = document.getElementById("formStatus");

  let stream = null;
  let facingMode = "user";
  let capturedImage = "";

  function showScreen(id) {
    screens.forEach(screen => screen.classList.toggle("active", screen.id === id));
  }

  function applyConfiguredAssets() {
    const start = document.querySelector(".start-screen");
    const resultBg = document.querySelector(".result-background");
    if (config.startBackground) start.style.setProperty("--start-image", `url("${config.startBackground}")`);
    if (config.resultBackground) resultBg.style.backgroundImage = `url("${config.resultBackground}")`;
  }

  async function startCamera() {
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Este navegador não oferece suporte à câmera.");
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 1920 }
        },
        audio: false
      });
      video.srcObject = stream;
      await video.play();
    } catch (error) {
      console.error(error);
      alert("Não foi possível acessar a câmera. Verifique a permissão do navegador e use HTTPS.");
      showScreen("startScreen");
    }
  }

  function stopCamera() {
    if (!stream) return;
    stream.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
  }

  function capturePhoto() {
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      alert("A câmera ainda não está pronta.");
      return;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (facingMode === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);
    capturedImage = canvas.toDataURL("image/jpeg", 0.9);

    stopCamera();
    transformImage(capturedImage);
  }

  async function transformImage(imageData) {
    showScreen("processingScreen");

    try {
      if (!config.aiEndpoint) {
        if (!config.demoMode) throw new Error("Endpoint de IA não configurado.");
        await new Promise(resolve => setTimeout(resolve, 1300));
        resultImage.src = imageData;
        showScreen("resultScreen");
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 240000);

      const response = await fetch(config.aiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || `Falha na IA: ${response.status}`);
      }
      const transformed = payload.image || payload.imageUrl;
      if (!transformed) throw new Error("A API não retornou uma imagem.");

      resultImage.src = transformed;
      showScreen("resultScreen");
    } catch (error) {
      console.error(error);
      const message = error?.name === "AbortError"
        ? "A geração demorou mais que o esperado. Tente novamente."
        : error?.message || "Não foi possível transformar a imagem.";

      alert(message);
      showScreen("cameraScreen");
      await startCamera();
    }
  }

  function saveLead(lead) {
    const key = "avatarGameLeads";
    const current = JSON.parse(localStorage.getItem(key) || "[]");
    current.push(lead);
    localStorage.setItem(key, JSON.stringify(current));
  }

  function openEmailShare(lead) {
    const recipient = config.shareRecipient || "";
    const subject = encodeURIComponent("Meu personagem da experiência");
    const body = encodeURIComponent(
      `Olá, ${lead.name}!\n\nSua imagem foi criada na experiência interativa.\n\n` +
      "Observação: para anexar a imagem automaticamente, conecte um serviço de envio no backend."
    );
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  }

  function exportLeadsCsv() {
    const leads = JSON.parse(localStorage.getItem("avatarGameLeads") || "[]");
    if (!leads.length) {
      alert("Nenhum cadastro foi salvo neste navegador.");
      return;
    }

    const header = ["data", "nome", "telefone", "email"];
    const rows = leads.map(item => [
      item.createdAt,
      item.name,
      item.phone,
      item.email
    ]);

    const csv = [header, ...rows]
      .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leads-avatar-game-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  document.getElementById("startButton").addEventListener("click", async () => {
    showScreen("cameraScreen");
    await startCamera();
  });

  document.getElementById("captureButton").addEventListener("click", capturePhoto);

  document.getElementById("switchCameraButton").addEventListener("click", async () => {
    facingMode = facingMode === "user" ? "environment" : "user";
    await startCamera();
  });

  document.getElementById("retakeButton").addEventListener("click", async () => {
    showScreen("cameraScreen");
    await startCamera();
  });

  document.getElementById("shareEmailButton").addEventListener("click", () => {
    form.reset();
    formStatus.textContent = "";
    dialog.showModal();
  });

  document.getElementById("closeDialogButton").addEventListener("click", () => dialog.close());

  document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
      stopCamera();
      showScreen(button.dataset.go);
    });
  });

  form.addEventListener("submit", event => {
    event.preventDefault();

    const lead = {
      createdAt: new Date().toISOString(),
      name: document.getElementById("leadName").value.trim(),
      phone: document.getElementById("leadPhone").value.trim(),
      email: document.getElementById("leadEmail").value.trim()
    };

    saveLead(lead);
    formStatus.textContent = "Dados salvos neste dispositivo. Abrindo o aplicativo de e-mail...";
    setTimeout(() => {
      openEmailShare(lead);
      dialog.close();
    }, 500);
  });

  // Atalho administrativo: Ctrl/Cmd + Shift + E exporta os cadastros em CSV.
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "e") {
      exportLeadsCsv();
    }
  });

  window.addEventListener("beforeunload", stopCamera);
  applyConfiguredAssets();
})();
