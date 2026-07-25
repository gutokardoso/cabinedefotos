# Avatar AI Game — versão 2

Projeto web responsivo pronto para GitHub e Vercel, agora com integração serverless para transformação real da fotografia pela OpenAI.

## Recursos

- Tela inicial personalizável.
- Câmera frontal e traseira.
- Captura da fotografia.
- Transformação por IA usando `gpt-image-2`.
- Preservação orientada de fisionomia, cabelo, roupas, acessórios e pose.
- Tela final em tela inteira com fundo substituível.
- Formulário de nome, telefone e e-mail.
- Armazenamento local dos cadastros.
- Exportação CSV compatível com Excel.
- Compartilhamento por aplicativo de e-mail.

## Configuração obrigatória no Vercel

1. Publique este projeto no GitHub.
2. Importe o repositório no Vercel.
3. No projeto do Vercel, abra `Settings > Environment Variables`.
4. Crie a variável:

```text
OPENAI_API_KEY
```

5. Cole sua chave da OpenAI no valor.
6. Habilite a variável para Production, Preview e Development.
7. Faça um novo deploy.

A chave nunca deve ser inserida no `app.js`, `config.js` ou enviada ao GitHub.

## Arquivos da integração

- `api/transform-image.js`: função protegida que recebe a foto e chama a OpenAI.
- `package.json`: instala o SDK oficial `openai`.
- `config.js`: aponta o game para `/api/transform-image`.
- `.env.example`: exemplo do nome da variável, sem uma chave real.

## Troca de identidade visual

Adicione os arquivos abaixo em `assets`:

- `start-background.jpg`
- `result-background.jpg`

## Teste local

Com Node.js instalado:

```bash
npm install
npm install -g vercel
vercel dev
```

Crie localmente um arquivo `.env.local`:

```text
OPENAI_API_KEY=sua-chave-real
```

Não envie `.env.local` ao GitHub.

## Exportação dos leads

- Windows: `Ctrl + Shift + E`
- macOS: `Command + Shift + E`

Os dados são salvos no navegador do equipamento. Para centralizar leads de vários aparelhos, será necessária uma integração posterior com banco de dados.

## Observações

- A câmera exige HTTPS; o Vercel fornece HTTPS automaticamente.
- A geração por IA consome créditos da conta da API.
- Algumas contas podem precisar concluir a verificação da organização para usar modelos GPT Image.
- O envio automático da imagem como anexo por e-mail exige um serviço de e-mail no backend. O `mailto:` apenas abre o aplicativo de e-mail.
