# DLC Radar Web

Versão online-ready do DLC Radar.

A ideia desta versão é permitir que qualquer pessoa acesse um site, acompanhe jogos da Steam e salve a própria lista **localmente no navegador**, sem login e sem banco de dados.

## Como funciona

- O usuário pesquisa um jogo da Steam.
- O usuário adiciona o jogo ao radar.
- A lista fica salva no `localStorage` do navegador da pessoa.
- O site chama rotas serverless internas:
  - `/api/search?q=nome`
  - `/api/dlc?appid=123`
- Essas rotas consultam a Steam pelo servidor, evitando erro de CORS no navegador.
- Quando o usuário clica em "Checar", o site compara as DLCs salvas localmente com as DLCs retornadas pela Steam.
- Se houver DLC nova, o site registra uma novidade local para aquela pessoa.

## Limitações

Como a lista é local:

- Não existe sincronização entre celular e PC.
- Se a pessoa limpar dados do navegador, perde a lista.
- O site não consegue notificar automaticamente com a aba fechada nesta versão.
- Para notificações reais com site fechado, seria necessário implementar Push Notifications + Service Worker + armazenamento de subscriptions em servidor.

## Rodar localmente

Instale Node.js 20+.

```bash
npm install
npm run dev
```

Acesse:

```txt
http://localhost:3000
```

## Publicar na Vercel

1. Crie um repositório no GitHub com estes arquivos.
2. Entre na Vercel.
3. Clique em "Add New Project".
4. Importe o repositório.
5. Use as configurações padrão de Next.js.
6. Deploy.

Não precisa configurar banco, variável de ambiente nem login.

## Estrutura

```txt
app/
  api/
    search/route.js  # busca jogos na Steam Store
    dlc/route.js     # busca DLCs de um jogo base
  globals.css
  layout.jsx
  page.jsx
```

## Próximos upgrades possíveis

- Exportar/importar lista em JSON.
- Criar backup via arquivo.
- Filtro por plataforma.
- Alertas por e-mail com login opcional.
- Notificações push.
- Integração com IGDB para expansões que ainda não aparecem como DLC estruturada na Steam.
