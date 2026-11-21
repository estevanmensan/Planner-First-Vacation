-- Rode no Supabase: SQL Editor > New query > Run
-- Tabela com a programação editada de cada dia (a original fica no app.js)

create table if not exists public.programacao (
  dia            int primary key check (dia between 1 and 31),
  tipo           text not null default 'eventos' check (tipo in ('eventos','X','?')),
  eventos        jsonb not null default '[]'::jsonb,
  atualizado_em  timestamptz not null default now()
);

alter table public.programacao enable row level security;

-- Qualquer visitante vê a programação (como o calendário original já mostra);
-- só quem está logado pode editar.
grant select on public.programacao to anon, authenticated;
grant insert, update, delete on public.programacao to authenticated;

create policy "todos leem programacao"     on public.programacao for select to anon, authenticated using (true);
create policy "logados criam programacao"  on public.programacao for insert to authenticated with check (true);
create policy "logados editam programacao" on public.programacao for update to authenticated using (true) with check (true);
create policy "logados apagam programacao" on public.programacao for delete to authenticated using (true);
