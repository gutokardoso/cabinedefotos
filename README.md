# Avatar AI Game v5 — Vercel + QR Code

Nesta versão, as funções são publicadas automaticamente pela Vercel e a entrega da imagem não depende de Resend, SMTP ou configuração de DNS.

## Fluxo

1. O participante tira a foto.
2. A Vercel Function envia a imagem para a OpenAI.
3. A imagem gerada é armazenada no Supabase Storage.
4. O participante preenche nome, telefone e e-mail para o cadastro do lead.
5. O sistema cria um link seguro válido por 30 dias e um QR Code.
6. O participante pode abrir, baixar, copiar o link ou compartilhar pelo recurso nativo do celular.

> Importante: envio automático de e-mail sempre exige algum servidor/provedor de e-mail autenticado. Esta versão elimina essa dependência e entrega a imagem imediatamente por QR Code e link.

## Estrutura

- `api/generate-avatar.js`: geração da imagem.
- `api/share-avatar.js`: salva o lead e gera link assinado + QR Code.
- `api/admin-data.js`: painel administrativo.
- `supabase/setup.sql`: tabelas e bucket privado.

## 1. Supabase

Abra **SQL Editor**, cole o conteúdo de `supabase/setup.sql` e clique em **Run**.

## 2. Variáveis no Vercel

Em **Settings → Environment Variables**, cadastre:

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

Não são mais necessárias:

```text
RESEND_API_KEY
EMAIL_FROM
```

## 3. Publicação

Suba o conteúdo desta pasta para a raiz do repositório conectado à Vercel e faça um novo deploy. A pasta `api/` deve permanecer na raiz.

## 4. Painel administrativo

Acesse `/admin.html` e informe a senha configurada em `ADMIN_PASSWORD`.

## Observação sobre e-mail

Não existe envio automático de e-mail apenas com HTML/JavaScript do navegador. Para enviar e-mails sem abrir o aplicativo do participante, é obrigatório usar SMTP ou um serviço de e-mail transacional. O QR Code e o compartilhamento nativo são a alternativa sem cadastro de provedor e sem alteração de DNS.
