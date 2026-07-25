# Avatar AI Game v6

Versão otimizada para uso em totem de evento.

## Fluxo de entrega ao participante

1. A foto é capturada e transformada.
2. O participante informa nome, telefone e e-mail.
3. O sistema salva o lead e cria um token seguro com validade de 30 dias.
4. O QR Code abre `foto.html` no celular do participante.
5. A página mobile mostra a imagem e oferece:
   - **Salvar na galeria** via menu nativo do celular;
   - **Compartilhar**;
   - **Abrir imagem**;
   - instruções para iPhone e Android.

No iPhone, sites não podem salvar silenciosamente na galeria. O botão abre o menu nativo para o usuário escolher **Salvar Imagem**. Como alternativa, ele pode tocar e segurar a foto e selecionar **Salvar em Fotos**.

## Publicação

Suba todo o conteúdo desta pasta para a raiz do repositório conectado à Vercel.

A Vercel publicará automaticamente:

- `/api/generate-avatar`
- `/api/share-avatar`
- `/api/photo-access`
- `/api/admin-data`

## Variáveis da Vercel

```text
OPENAI_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_PASSWORD
```

Opcionais:

```text
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_QUALITY=medium
```

## Atualização do Supabase

Abra o **SQL Editor** do Supabase e execute todo o arquivo:

```text
supabase/setup.sql
```

Ele cria as tabelas quando necessário e adiciona os campos `delivery_token` e `delivery_expires_at` usados pelos links seguros.

## Depois de atualizar

Faça um novo deploy na Vercel. Não é necessário configurar Resend, SMTP ou DNS para o fluxo por QR Code.
