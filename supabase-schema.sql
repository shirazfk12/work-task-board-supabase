-- Run this in Supabase SQL Editor

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  team text,
  poc text,
  status text not null default 'Backlog',
  priority text not null default 'Medium',
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

-- Simple public policy for personal use.
-- Anyone with your anon key can read/write this table.
-- For private/authenticated use, replace this later with auth-based policies.
drop policy if exists "Public read tasks" on public.tasks;
drop policy if exists "Public insert tasks" on public.tasks;
drop policy if exists "Public update tasks" on public.tasks;
drop policy if exists "Public delete tasks" on public.tasks;

create policy "Public read tasks"
on public.tasks for select
using (true);

create policy "Public insert tasks"
on public.tasks for insert
with check (true);

create policy "Public update tasks"
on public.tasks for update
using (true)
with check (true);

create policy "Public delete tasks"
on public.tasks for delete
using (true);
