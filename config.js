window.GAME_CONFIG = {
  // Troque pelos arquivos enviados pelo cliente dentro da pasta /assets:
  startBackground: "assets/start-background.jpg",
  resultBackground: "assets/result-background.jpg",

  // Endpoint opcional para transformação por IA.
  // Deve receber JSON: { image: "data:image/jpeg;base64,..." }
  // Deve responder JSON: { image: "data:image/png;base64,..." } ou { imageUrl: "https://..." }
  aiEndpoint: "/api/transform-image",

  // E-mail que receberá o compartilhamento via aplicativo de e-mail.
  shareRecipient: "contato@seudominio.com",

  // Em modo demonstração, a foto capturada é exibida sem transformação quando não há endpoint.
  demoMode: false
};
