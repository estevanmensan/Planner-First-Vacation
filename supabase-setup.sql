-- Rode este script no Supabase: SQL Editor > New query > Run

-- 1) Tabela que liga cada foto ao seu dia
create table if not exists public.fotos (
  id         uuid primary key default gen_random_uuid(),
  dia        int  not null check (dia between 1 and 31),
  caminho    text not null unique,
  criado_em  timestamptz not null default now(),
  user_id    uuid default auth.uid()
);

alter table public.fotos enable row level security;

-- Libera a tabela para o site (Data API). Projetos novos não liberam sozinhos.
grant select, insert, delete on public.fotos to authenticated;

-- Só quem está logado lê, adiciona e apaga
create policy "logados leem fotos"   on public.fotos for select to authenticated using (true);
create policy "logados inserem fotos" on public.fotos for insert to authenticated with check (true);
create policy "logados apagam fotos"  on public.fotos for delete to authenticated using (true);

-- 2) Bucket PRIVADO para os arquivos das imagens
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

create policy "logados leem arquivos"   on storage.objects for select to authenticated using (bucket_id = 'fotos');
create policy "logados enviam arquivos" on storage.objects for insert to authenticated with check (bucket_id = 'fotos');
create policy "logados apagam arquivos" on storage.objects for delete to authenticated using (bucket_id = 'fotos');

-- 3) Programação editável dos dias

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
