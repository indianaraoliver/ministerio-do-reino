-- ============================================================
-- Ministério do Reino — estrutura de dados no Supabase
-- Como usar: no painel do Supabase -> SQL Editor -> New query
-- -> cole TUDO isto -> Run.
-- ============================================================

-- Tabela que guarda o estado do app (uma linha por usuário)
create table if not exists public.app_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Segurança: cada pessoa só enxerga/edita os PRÓPRIOS dados
alter table public.app_state enable row level security;

drop policy if exists "own_select" on public.app_state;
drop policy if exists "own_insert" on public.app_state;
drop policy if exists "own_update" on public.app_state;

create policy "own_select" on public.app_state
  for select using (auth.uid() = user_id);

create policy "own_insert" on public.app_state
  for insert with check (auth.uid() = user_id);

create policy "own_update" on public.app_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Permissões de tabela para o usuário logado (o RLS acima restringe às próprias linhas).
-- O "anon" (visitante não logado) fica SEM acesso, de propósito.
grant select, insert, update, delete on public.app_state to authenticated;
