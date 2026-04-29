-- ad_blocks: admin-managed ad/affiliate placements rendered by <AdSlot/>.
-- Run once in the Supabase SQL editor. The Storage bucket setup at the
-- bottom must be created via the Supabase dashboard UI (or the Storage
-- API) — buckets are not part of the SQL schema.

create extension if not exists "pgcrypto";

create table if not exists ad_blocks (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,                  -- admin-only label
  slot         text not null,                  -- "homepage-mid", etc.
  html         text not null,                  -- rendered as raw HTML
  enabled      boolean not null default true,
  -- Quick-banner inputs preserved so the form can be re-opened and edited
  -- without losing structure. Both null when admin pasted raw html.
  image_url    text,
  click_url    text,
  alt_text     text,
  -- Optional schedule. When start_at/end_at are set, the slot only renders
  -- the block during that window (server-side check in lib/ads.ts).
  start_at     timestamptz,
  end_at       timestamptz,
  -- Optional URL pattern restricting which pages this block shows on, e.g.
  -- "/compare/austin-tx-vs-denver-co" or a prefix like "/blog/". Matched
  -- by simple startsWith() in the slot component.
  page_filter  text,
  -- If multiple enabled blocks match a slot+page, weight controls
  -- which wins (or could be used for round-robin later).
  weight       integer not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists ad_blocks_slot_enabled_idx
  on ad_blocks (slot, enabled);

-- updated_at auto-bump on any UPDATE
create or replace function ad_blocks_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ad_blocks_updated_at on ad_blocks;
create trigger ad_blocks_updated_at
  before update on ad_blocks
  for each row execute function ad_blocks_set_updated_at();

-- ---------------------------------------------------------------------------
-- STORAGE BUCKET (manual step in Supabase dashboard)
-- ---------------------------------------------------------------------------
-- 1. Storage → New bucket → name: "ad-images" → public: yes → save.
-- 2. Optional: add policy denying anonymous upload (default RLS already
--    requires service-role for inserts; the admin server actions use the
--    service-role key so they bypass RLS).
-- 3. Upload sanity check: the admin form will write to ad-images/<uuid>.<ext>.
