(() => {
  "use strict";

  const image = document.getElementById("photoImage");
  const loader = document.getElementById("photoLoader");
  const status = document.getElementById("photoStatus");
  const actions = document.getElementById("photoActions");
  const instructions = document.getElementById("instructions");
  const saveButton = document.getElementById("saveGalleryButton");
  const shareButton = document.getElementById("shareButton");
  const openButton = document.getElementById("openImageButton");

  let imageUrl = "";
  let fileName = "personagem.jpg";
  let imageFile = null;

  function tokenFromUrl() {
    return new URLSearchParams(window.location.search).get("t") || "";
  }

  async function loadImage() {
    const token = tokenFromUrl();
    if (!token) throw new Error("O link da foto está incompleto.");

    const response = await fetch(`/api/photo-access?t=${encodeURIComponent(token)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Não foi possível abrir a imagem.");

    imageUrl = payload.imageUrl;
    fileName = payload.fileName || fileName;
    image.src = imageUrl;
    openButton.href = imageUrl;

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    });

    loader.hidden = true;
    image.hidden = false;
    actions.hidden = false;
    instructions.hidden = false;
    status.textContent = "Imagem carregada. Toque em “Salvar na galeria”.";
  }

  async function getShareableFile() {
    if (imageFile) return imageFile;
    const response = await fetch(imageUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível preparar a imagem para salvar.");
    const blob = await response.blob();
    const type = blob.type || "image/jpeg";
    imageFile = new File([blob], fileName, { type });
    return imageFile;
  }

  async function shareImage() {
    const file = await getShareableFile();
    const data = { title: "Meu personagem", text: "Minha foto do evento", files: [file] };

    if (navigator.canShare?.(data) && navigator.share) {
      await navigator.share(data);
      return true;
    }
    return false;
  }

  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    status.textContent = "Preparando a imagem...";
    try {
      const shared = await shareImage();
      if (shared) {
        status.textContent = "No menu do celular, escolha “Salvar Imagem” ou “Salvar em Fotos”.";
      } else {
        window.open(imageUrl, "_blank", "noopener");
        status.textContent = "A imagem foi aberta. Toque e segure nela para salvar na galeria.";
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        status.textContent = "Ação cancelada. Toque novamente quando estiver pronto.";
      } else {
        console.error(error);
        window.open(imageUrl, "_blank", "noopener");
        status.textContent = "Toque e segure a imagem aberta e escolha salvar em Fotos/Galeria.";
      }
    } finally {
      saveButton.disabled = false;
    }
  });

  shareButton.addEventListener("click", async () => {
    shareButton.disabled = true;
    try {
      const shared = await shareImage();
      if (!shared && navigator.share) {
        await navigator.share({ title: "Meu personagem", url: window.location.href });
      } else if (!shared) {
        await navigator.clipboard.writeText(window.location.href);
        status.textContent = "Link copiado para compartilhar.";
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error);
        status.textContent = "Não foi possível compartilhar agora.";
      }
    } finally {
      shareButton.disabled = false;
    }
  });

  loadImage().catch((error) => {
    console.error(error);
    loader.hidden = true;
    status.textContent = error.message;
    status.classList.add("error");
  });
})();
