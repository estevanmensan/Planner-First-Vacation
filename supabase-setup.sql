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
