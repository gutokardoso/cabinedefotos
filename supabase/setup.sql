create extension if not exists pgcrypto;

create table if not exists public.avatar_generations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  original_path text not null,
  generated_path text,
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  error_message text
);

create table if not exists public.avatar_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  generation_id uuid not null references public.avatar_generations(id) on delete cascade,
  name text not null,
  phone text not null,
  email text not null,
  consent boolean not null default false,
  email_status text not null default 'pending' check (email_status in ('pending','sending','sent','failed')),
  email_provider_id text,
  email_error text,
  emailed_at timestamptz
);

create index if not exists avatar_leads_created_at_idx on public.avatar_leads(created_at desc);
create index if not exists avatar_leads_email_idx on public.avatar_leads(email);

alter table public.avatar_generations enable row level security;
alter table public.avatar_leads enable row level security;

-- Nenhuma policy pública é criada. Todas as operações passam pelas Vercel Functions
-- utilizando a service role, que nunca é exposta no navegador.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatar-images',
  'avatar-images',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Campos usados pela página mobile segura da versão 6.
alter table public.avatar_leads
  add column if not exists delivery_token text,
  add column if not exists delivery_expires_at timestamptz;

create unique index if not exists avatar_leads_delivery_token_idx
  on public.avatar_leads(delivery_token)
  where delivery_token is not null;
