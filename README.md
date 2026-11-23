# Ministério do Reino

App (PWA) para acompanhar o serviço: horas por modalidade, agenda, metas (pioneiro
regular 600h / auxiliar 360h), estudos e revisitas, rotina espiritual e relatório mensal
pelo WhatsApp — com **login e dados sincronizados na nuvem** (Supabase).

## Tecnologia
- Frontend estático (HTML/CSS/JS puro, sem build) — PWA instalável e offline.
- **Supabase**: Auth (login por e-mail/senha) + Postgres (tabela `app_state`, uma linha
  por usuário, protegida por Row Level Security).
- **Vercel**: hospedagem.

## Configuração
As chaves do Supabase ficam em `config.js` (`SUPA_URL` e `SUPA_ANON` — chave *publishable*,
pública por design; a segurança é feita pelo RLS). O SQL do banco está em `supabase-setup.sql`.

## Estrutura
- `index.html` — página única.
- `app.js` — toda a lógica do app.
- `cloud.js` — login + sincronização com o Supabase.
- `config.js` — chaves do Supabase.
- `styles.css` — estilos (temas rosé e azul bebê).
- `sw.js` + `manifest.webmanifest` — PWA (offline + instalação).
