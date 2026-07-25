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
  let generationId = "";

  function showScreen(id) {
    screens.forEach((screen) => screen.classList.toggle("active", screen.id === id));
  }

  async function callApi(endpoint, payload) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Erro ${response.status} ao acessar o servidor.`);
    }
    return body;
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
    stream.getTracks().forEach((track) => track.stop());
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

    const maxWidth = 1024;
    const maxHeight = 1536;
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");

    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    capturedImage = canvas.toDataURL("image/jpeg", 0.78);
    stopCamera();
    transformImage(capturedImage);
  }

  async function transformImage(imageData) {
    showScreen("processingScreen");

    try {
      if (config.demoMode) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        resultImage.src = imageData;
        generationId = `demo-${Date.now()}`;
        showScreen("resultScreen");
        return;
      }

      const payload = await callApi(config.generateEndpoint || "/api/generate-avatar", {
        image: imageData
      });

      if (!(payload.image || payload.imageUrl) || !payload.generationId) {
        throw new Error("O servidor não retornou a imagem completa.");
      }

      generationId = payload.generationId;
      resultImage.src = payload.image || payload.imageUrl;
      showScreen("resultScreen");
    } catch (error) {
      console.error(error);
      alert(`Não foi possível gerar o personagem. ${error.message}`);
      showScreen("cameraScreen");
      await startCamera();
    }
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
    generationId = "";
    capturedImage = "";
    showScreen("cameraScreen");
    await startCamera();
  });

  document.getElementById("shareEmailButton").addEventListener("click", () => {
    if (!generationId) {
      alert("Gere uma imagem antes de compartilhar.");
      return;
    }
    form.reset();
    formStatus.textContent = "";
    dialog.showModal();
  });

  document.getElementById("closeDialogButton").addEventListener("click", () => dialog.close());

  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      stopCamera();
      showScreen(button.dataset.go);
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    formStatus.textContent = "Salvando cadastro e enviando a imagem...";

    try {
      const payload = await callApi(config.shareEndpoint || "/api/share-avatar", {
        generationId,
        name: document.getElementById("leadName").value.trim(),
        phone: document.getElementById("leadPhone").value.trim(),
        email: document.getElementById("leadEmail").value.trim(),
        consent: document.getElementById("leadConsent").checked
      });

      formStatus.textContent = payload.message || "Imagem enviada com sucesso!";
      setTimeout(() => dialog.close(), 1600);
    } catch (error) {
      console.error(error);
      formStatus.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });

  window.addEventListener("beforeunload", stopCamera);
})();
