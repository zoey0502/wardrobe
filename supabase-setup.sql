-- 電子衣櫃：Supabase 資料庫設定
-- 用法：Supabase 專案 → SQL Editor → New query → 整段貼上 → Run

-- 衣服
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text default '',
  cat text,
  colors text[] not null default '{}',
  seasons text[] not null default '{}',
  freq text,
  reason text default '',
  action text,
  note text default '',
  photo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 搭配
create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text default '',
  item_ids uuid[] not null default '{}',
  note text default '',
  photo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 要買的
create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- 每個人只能看到、修改自己的資料
alter table public.items enable row level security;
alter table public.outfits enable row level security;
alter table public.wishlist enable row level security;

drop policy if exists "own items" on public.items;
create policy "own items" on public.items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own outfits" on public.outfits;
create policy "own outfits" on public.outfits for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own wishlist" on public.wishlist;
create policy "own wishlist" on public.wishlist for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 照片：私人儲存空間，每個人只能存取自己資料夾裡的照片
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "own photos select" on storage.objects;
create policy "own photos select" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own photos insert" on storage.objects;
create policy "own photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own photos update" on storage.objects;
create policy "own photos update" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own photos delete" on storage.objects;
create policy "own photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
