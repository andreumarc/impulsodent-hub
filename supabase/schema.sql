-- ─────────────────────────────────────────────
-- ImpulsoDent Hub — Database Schema
-- Run this in your Supabase SQL editor
-- ─────────────────────────────────────────────

-- Companies (dental clinic groups)
create table if not exists companies (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  slug        text unique not null,
  email       text,
  phone       text,
  address     text,
  active      boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Hub users (managed by superadmin, used for hub login)
create table if not exists hub_users (
  id            uuid default gen_random_uuid() primary key,
  email         text unique not null,
  password_hash text not null,
  name          text not null,
  role          text not null default 'admin', -- superadmin | admin | user
  company_id    uuid references companies(id) on delete set null,
  active        boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- App access permissions per company
create table if not exists company_app_access (
  id          uuid default gen_random_uuid() primary key,
  company_id  uuid references companies(id) on delete cascade not null,
  app_id      text not null,
  granted_at  timestamptz default now(),
  unique(company_id, app_id)
);

-- App registrations (URL + secret for syncing users to each app)
create table if not exists app_registrations (
  id           uuid default gen_random_uuid() primary key,
  app_id       text unique not null,
  name         text not null,
  sync_url     text,
  api_secret   text,
  sync_enabled boolean default false,
  last_sync_at timestamptz
);

-- Sync log
create table if not exists sync_logs (
  id            uuid default gen_random_uuid() primary key,
  app_id        text not null,
  company_id    uuid references companies(id),
  event         text not null,
  status        text not null, -- success | failed | pending
  response_code int,
  error_message text,
  created_at    timestamptz default now()
);

-- Indexes
create index if not exists hub_users_company_id_idx on hub_users(company_id);
create index if not exists company_app_access_company_id_idx on company_app_access(company_id);
create index if not exists sync_logs_app_id_idx on sync_logs(app_id);
create index if not exists sync_logs_company_id_idx on sync_logs(company_id);

-- Seed app registrations (one per app in the suite)
insert into app_registrations (app_id, name, sync_enabled) values
  ('clinicpnl',     'ClinicPNL',     false),
  ('clinicvox',     'ClinicVox',     false),
  ('dentalspot',    'DentalSpot',    false),
  ('dentalhr',      'DentalHR',      false),
  ('fichaje',       'FichajeSaaS',   false),
  ('spendflow',     'SpendFlow',     false),
  ('zentrix',       'ZENTRIX',       false),
  ('nexuserp',      'NexusERP',      false),
  ('dentalreports', 'DentalReports', false)
on conflict (app_id) do nothing;
