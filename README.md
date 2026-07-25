# Avatar AI Game v3 — Supabase + OpenAI + Resend

Versão pronta para publicação do front-end no GitHub/Vercel e do backend no Supabase.

## O que esta versão faz

1. Liga a câmera e captura a fotografia.
2. Envia a foto para uma Supabase Edge Function.
3. A Edge Function chama a API de edição de imagens da OpenAI.
4. Salva a foto original e a imagem gerada em um bucket privado do Supabase Storage.
5. Exibe o personagem no game.
6. Salva nome, telefone, e-mail e consentimento no banco.
7. Envia a imagem automaticamente por e-mail usando Resend.
8. Disponibiliza `admin.html` para consultar os leads, visualizar as imagens e exportar CSV.

## Estrutura

- `index.html`: game.
- `admin.html`: painel administrativo.
- `config.js`: URL e chave pública do Supabase.
- `supabase/setup.sql`: banco, índices, RLS e bucket privado.
- `supabase/functions/generate-avatar`: geração e armazenamento.
- `supabase/functions/share-avatar`: cadastro e envio por e-mail.
- `supabase/functions/admin-data`: consulta protegida do painel.

# Configuração

## 1. Criar o projeto Supabase

Crie um projeto gratuito no Supabase.

Abra **SQL Editor**, cole todo o conteúdo de `supabase/setup.sql` e execute.

Isso criará:

- tabela `avatar_generations`;
- tabela `avatar_leads`;
- bucket privado `avatar-images`;
- índices e Row Level Security.

## 2. Configurar o front-end

No Supabase, abra **Project Settings → API** e copie:

- Project URL;
- chave pública `anon` ou `publishable`.

Edite `config.js`:

```js
supabaseUrl: "https://SEU-PROJETO.supabase.co",
supabaseAnonKey: "SUA_CHAVE_PUBLICA_ANON",
```

Essa chave é pública por definição. As chaves privadas nunca ficam no front-end.

## 3. Criar as chaves externas

Você precisará de:

- uma chave da API da OpenAI;
- uma chave do Resend;
- um domínio verificado no Resend para o remetente.

## 4. Adicionar os secrets no Supabase

No painel do Supabase, abra **Edge Functions → Secrets** e adicione:

```text
OPENAI_API_KEY=sk-proj-...
RESEND_API_KEY=re_...
EMAIL_FROM=Avatar Experience <fotos@seudominio.com>
ADMIN_PASSWORD=uma-senha-forte
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` ficam disponíveis automaticamente nas Edge Functions.

## 5. Publicar as Edge Functions

### Pelo Dashboard

Crie três funções com os nomes exatos:

- `generate-avatar`
- `share-avatar`
- `admin-data`

Cole o conteúdo do respectivo `index.ts` e publique cada função com a verificação JWT desativada.

### Pela CLI

Instale e autentique a Supabase CLI, entre na pasta do projeto e execute:

```bash
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy generate-avatar --no-verify-jwt
supabase functions deploy share-avatar --no-verify-jwt
supabase functions deploy admin-data --no-verify-jwt
```

Depois adicione os secrets:

```bash
supabase secrets set OPENAI_API_KEY="sk-proj-..."
supabase secrets set RESEND_API_KEY="re_..."
supabase secrets set EMAIL_FROM="Avatar Experience <fotos@seudominio.com>"
supabase secrets set ADMIN_PASSWORD="uma-senha-forte"
```

## 6. Publicar o game

Envie os arquivos para o GitHub e importe o repositório no Vercel. Não é necessária nenhuma variável privada no Vercel, pois o backend e os secrets ficam no Supabase.

A câmera exige HTTPS, fornecido automaticamente pelo Vercel.

## 7. Acessar o painel

Abra:

```text
https://seu-site.vercel.app/admin.html
```

Digite o valor configurado em `ADMIN_PASSWORD`.

O painel permite:

- visualizar os cadastros;
- abrir as imagens por links temporários;
- conferir o status do e-mail;
- exportar CSV compatível com Excel.

# Identidade visual

Adicione na pasta `assets`:

- `start-background.jpg` para a tela inicial;
- `result-background.jpg` para a tela final.

# Observações importantes

- O plano gratuito do Supabase possui limites de banco, Storage e Edge Functions.
- A OpenAI cobra cada imagem gerada conforme modelo, tamanho e qualidade.
- O Resend possui limites de envio conforme o plano da conta.
- O bucket é privado; o painel gera links temporários de uma hora.
- A imagem enviada por e-mail vai como anexo, não como link público.
- Antes de uso comercial, publique uma política de privacidade e defina prazo de retenção das fotos e dados.
- Como a função de geração é pública para permitir o uso no evento, em campanhas abertas na internet é recomendável adicionar Cloudflare Turnstile ou outro controle antiabuso.
