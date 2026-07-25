# Avatar AI Game v4 — Vercel Functions automáticas

Esta versão não usa Supabase Edge Functions. As três funções ficam na pasta `api/` e são publicadas automaticamente quando o projeto é enviado ao Vercel.

## O que continua no Supabase

- Banco de dados dos leads.
- Storage privado das fotos e avatares.

## O que fica no Vercel

- `/api/generate-avatar`: recebe a foto, chama a OpenAI e salva no Supabase.
- `/api/share-avatar`: salva o lead e envia a imagem por e-mail.
- `/api/admin-data`: alimenta o painel administrativo.

## Publicação simplificada

1. Crie um repositório no GitHub e envie todos os arquivos desta pasta.
2. Importe o repositório no Vercel.
3. No Supabase, abra `SQL Editor` e execute o arquivo `supabase/setup.sql` uma única vez.
4. No Vercel, abra `Settings → Environment Variables` e cadastre as variáveis listadas abaixo.
5. Clique em `Redeploy`.

Não existe etapa de publicar funções manualmente. O Vercel detecta a pasta `api` no deploy.

## Variáveis obrigatórias no Vercel

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `ADMIN_PASSWORD`

Variáveis opcionais:

- `OPENAI_IMAGE_MODEL` — padrão: `gpt-image-2`
- `OPENAI_IMAGE_QUALITY` — padrão: `medium`

Depois de criar ou alterar uma variável, faça um novo deploy.

## Onde copiar as chaves do Supabase

No projeto Supabase, abra `Project Settings → API`:

- `Project URL` → `SUPABASE_URL`
- `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY`

A `service_role` nunca deve ser colocada no `config.js` nem publicada diretamente no GitHub.

## Banco e Storage

Execute o conteúdo de `supabase/setup.sql` no `SQL Editor` do Supabase. Ele cria:

- tabela `avatar_generations`;
- tabela `avatar_leads`;
- bucket privado `avatar-images`;
- regras de segurança.

## Painel administrativo

Abra:

`https://SEU-SITE.vercel.app/admin.html`

Use a senha cadastrada em `ADMIN_PASSWORD`.

## Imagens de identidade

Coloque em `assets/`:

- `start-background.jpg`
- `result-background.jpg`

## Observação sobre custos

A OpenAI cobra por uso da API de imagem. Supabase, Vercel e Resend podem ter faixas gratuitas com limites próprios.
