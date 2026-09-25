-- Contexto por clínica (horário, tom de voz, urgência, valor da avaliação,
-- textos do bot), dentistas, procedimentos, base de conhecimento, perguntas
-- que o bot não soube responder, e a marca de "já testou no simulador".

alter table public.config_clinica
  add column if not exists horario_funcionamento jsonb default '{}'::jsonb,
  add column if not exists tom_voz text default 'acolhedor',
  add column if not exists palavras_urgencia text[] default array['dor','inchaço','trauma','quebrou','sangue','urgente','emergência'],
  add column if not exists valor_avaliacao numeric,
  add column if not exists mensagens jsonb default '{}'::jsonb,
  add column if not exists simulador_testado_em timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'config_clinica_tom_voz_check') then
    alter table public.config_clinica
      add constraint config_clinica_tom_voz_check check (tom_voz in ('formal','acolhedor','descontraido'));
  end if;
end $$;

create table if not exists public.dentistas (
  id            uuid primary key default gen_random_uuid(),
  clinica_id    uuid not null references public.config_clinica(id) on delete cascade,
  nome          text not null,
  especialidade text,
  ativo         bool default true
);

create table if not exists public.procedimentos (
  id                uuid primary key default gen_random_uuid(),
  clinica_id        uuid not null references public.config_clinica(id) on delete cascade,
  nome              text not null,
  duracao_min       int not null,
  cal_event_type_id bigint not null,
  descricao         text,
  ativo             bool default true,
  ordem             int default 0
);
create index if not exists procedimentos_clinica_idx on public.procedimentos (clinica_id, ordem);

create table if not exists public.base_conhecimento (
  id         uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.config_clinica(id) on delete cascade,
  pergunta   text not null,
  resposta   text not null,
  ativo      bool default true
);
create index if not exists base_conhecimento_clinica_idx on public.base_conhecimento (clinica_id);

create table if not exists public.perguntas_sem_resposta (
  id         uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.config_clinica(id) on delete cascade,
  telefone   text,
  pergunta   text not null,
  resolvida  bool default false,
  created_at timestamptz default now()
);
create index if not exists perguntas_sem_resposta_clinica_idx on public.perguntas_sem_resposta (clinica_id, resolvida);

alter table public.dentistas enable row level security;
alter table public.procedimentos enable row level security;
alter table public.base_conhecimento enable row level security;
alter table public.perguntas_sem_resposta enable row level security;

drop policy if exists "clinica le os proprios dentistas" on public.dentistas;
create policy "clinica le os proprios dentistas" on public.dentistas
  for select to authenticated using (clinica_id in (select public.clinicas_do_usuario()));

drop policy if exists "clinica le os proprios procedimentos" on public.procedimentos;
create policy "clinica le os proprios procedimentos" on public.procedimentos
  for select to authenticated using (clinica_id in (select public.clinicas_do_usuario()));

drop policy if exists "clinica le a propria base" on public.base_conhecimento;
create policy "clinica le a propria base" on public.base_conhecimento
  for select to authenticated using (clinica_id in (select public.clinicas_do_usuario()));

drop policy if exists "clinica le as proprias perguntas" on public.perguntas_sem_resposta;
create policy "clinica le as proprias perguntas" on public.perguntas_sem_resposta
  for select to authenticated using (clinica_id in (select public.clinicas_do_usuario()));
