-- Módulo CRM: usuário ↔ clínica, instância do WhatsApp (Evolution API) e o
-- histórico de mensagens para o painel. Tudo com IF NOT EXISTS: o schema
-- inicial já existia e esta migração só estende.

create table if not exists public.usuarios_clinica (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  clinica_id uuid not null references public.config_clinica(id) on delete cascade,
  papel      text not null default 'recepcao' check (papel in ('admin','recepcao')),
  created_at timestamptz default now()
);

alter table public.config_clinica
  add column if not exists evolution_instance text unique,
  add column if not exists whatsapp_numero    text,
  add column if not exists whatsapp_status    text default 'desconectado';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'config_clinica_whatsapp_status_check') then
    alter table public.config_clinica
      add constraint config_clinica_whatsapp_status_check
      check (whatsapp_status in ('desconectado','aguardando_qr','conectado'));
  end if;
end $$;

create table if not exists public.mensagens (
  id         uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.config_clinica(id) on delete cascade,
  telefone   text not null,
  direcao    text not null check (direcao in ('entrada','saida')),
  origem     text not null default 'bot' check (origem in ('bot','humano','paciente')),
  conteudo   text,
  tipo       text default 'text',
  wamid      text unique,
  created_at timestamptz default now()
);
create index if not exists mensagens_conversa_idx on public.mensagens (clinica_id, telefone, created_at desc);

alter table public.usuarios_clinica enable row level security;
alter table public.mensagens enable row level security;

-- As clínicas do usuário logado, sem recursão de RLS (security definer).
create or replace function public.clinicas_do_usuario()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select clinica_id from public.usuarios_clinica where user_id = auth.uid()
$$;
revoke all on function public.clinicas_do_usuario() from public;
grant execute on function public.clinicas_do_usuario() to authenticated;

-- Leitura pela própria clínica. Escrita só pelo servidor (service_role).
drop policy if exists "usuario le a propria ligacao" on public.usuarios_clinica;
create policy "usuario le a propria ligacao" on public.usuarios_clinica
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "clinica le as proprias mensagens" on public.mensagens;
create policy "clinica le as proprias mensagens" on public.mensagens
  for select to authenticated using (clinica_id in (select public.clinicas_do_usuario()));

drop policy if exists "clinica le as proprias conversas" on public.conversas;
create policy "clinica le as proprias conversas" on public.conversas
  for select to authenticated using (clinica_id in (select public.clinicas_do_usuario()));

drop policy if exists "clinica le a propria config" on public.config_clinica;
create policy "clinica le a propria config" on public.config_clinica
  for select to authenticated using (id in (select public.clinicas_do_usuario()));

-- Realtime para o painel atualizar ao vivo.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensagens') then
    alter publication supabase_realtime add table public.mensagens;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversas') then
    alter publication supabase_realtime add table public.conversas;
  end if;
end $$;
