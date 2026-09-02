-- Notas de clientes (ficha del cliente en clientes-hub.html)
-- Correr en el proyecto Manual/Luciana: fzaxwuuodseyyinveknn
create table if not exists cliente_notas (
  id          bigint generated always as identity primary key,
  cliente_id  text not null,        -- id del cliente en el Manual
  codigo      text,                 -- código del cliente (CUBO)
  texto       text not null,
  autor       text,
  created_at  timestamptz default now()
);
create index if not exists cliente_notas_idx on cliente_notas(cliente_id, created_at desc);
alter table cliente_notas enable row level security;
do $$ begin
  begin create policy cn_all on cliente_notas for all using (true) with check (true); exception when duplicate_object then null; end;
end $$;
