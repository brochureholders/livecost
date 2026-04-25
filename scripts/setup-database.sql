-- UrbRank Supabase schema
-- Run this in the Supabase SQL editor or via: psql <connection-string> -f setup-database.sql

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto";

-- cities ---------------------------------------------------------------------
create table if not exists cities (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  state          text not null,
  state_code     char(2) not null,
  slug           text not null unique,
  fips_code      text,
  population     integer,
  latitude       numeric(9, 6),
  longitude      numeric(9, 6),
  metro_area     text,
  created_at     timestamptz not null default now()
);

create index if not exists cities_slug_idx       on cities (slug);
create index if not exists cities_state_code_idx on cities (state_code);

-- city_costs -----------------------------------------------------------------
create table if not exists city_costs (
  id                       uuid primary key default gen_random_uuid(),
  city_id                  uuid not null references cities(id) on delete cascade,
  year                     integer not null,
  median_household_income  numeric(12, 2),
  median_home_value        numeric(14, 2),
  median_rent              numeric(10, 2),
  cost_index               numeric(6, 2),
  grocery_index            numeric(6, 2),
  housing_index            numeric(6, 2),
  utilities_index          numeric(6, 2),
  transportation_index     numeric(6, 2),
  healthcare_index         numeric(6, 2),
  data_source              text,
  updated_at               timestamptz not null default now(),
  unique (city_id, year)
);

create index if not exists city_costs_city_year_idx on city_costs (city_id, year);

-- city_demographics ----------------------------------------------------------
create table if not exists city_demographics (
  id                     uuid primary key default gen_random_uuid(),
  city_id                uuid not null references cities(id) on delete cascade,
  year                   integer not null,
  median_age             numeric(5, 2),
  unemployment_rate      numeric(5, 2),
  poverty_rate           numeric(5, 2),
  college_educated_pct   numeric(5, 2),
  commute_time_avg       numeric(5, 2),
  population_growth_pct  numeric(6, 3),
  unique (city_id, year)
);

create index if not exists city_demographics_city_year_idx on city_demographics (city_id, year);

-- city_quality ---------------------------------------------------------------
create table if not exists city_quality (
  id                    uuid primary key default gen_random_uuid(),
  city_id               uuid not null references cities(id) on delete cascade,
  year                  integer not null,
  crime_rate_per_100k   numeric(10, 2),
  violent_crime_rate    numeric(10, 2),
  property_crime_rate   numeric(10, 2),
  avg_temp_summer       numeric(5, 2),
  avg_temp_winter       numeric(5, 2),
  annual_precipitation  numeric(6, 2),
  sunshine_days         integer,
  air_quality_index     numeric(6, 2),
  walk_score            integer,
  transit_score         integer,
  bike_score            integer,
  unique (city_id, year)
);

-- Columns added after initial schema. Safe to re-run.
alter table city_quality add column if not exists transit_score integer;
alter table city_quality add column if not exists bike_score    integer;

create index if not exists city_quality_city_year_idx on city_quality (city_id, year);

-- comparisons_cache ----------------------------------------------------------
create table if not exists comparisons_cache (
  id                uuid primary key default gen_random_uuid(),
  city_a_id         uuid not null references cities(id) on delete cascade,
  city_b_id         uuid not null references cities(id) on delete cascade,
  comparison_data   jsonb not null,
  computed_at       timestamptz not null default now(),
  unique (city_a_id, city_b_id)
);

create index if not exists comparisons_cache_pair_idx on comparisons_cache (city_a_id, city_b_id);

-- page_views ----------------------------------------------------------------
-- Lightweight pageview log for built-in analytics. No PII; just the path and
-- a hashed user agent / referrer. Write from server-side API route using the
-- service role key.
create table if not exists page_views (
  id             uuid primary key default gen_random_uuid(),
  path           text not null,
  referrer       text,
  user_agent     text,
  country        text,
  created_at     timestamptz not null default now()
);

create index if not exists page_views_path_idx       on page_views (path);
create index if not exists page_views_created_at_idx on page_views (created_at desc);

-- events --------------------------------------------------------------------
-- Custom event log for product analytics. Captures what users do beyond
-- pageviews — quiz started/completed, search queried/picked, compare pair
-- submitted, etc. Written via /api/event with the service role key.
-- `props` is a free-form JSONB column for event-specific context (e.g.
-- the quiz's top weights, a search query, the picked city slug).
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  path        text,
  props       jsonb,
  user_agent  text,
  country     text,
  created_at  timestamptz not null default now()
);

create index if not exists events_name_created_idx on events (name, created_at desc);
create index if not exists events_created_at_idx   on events (created_at desc);

-- urbrank_scores -----------------------------------------------------------
-- Computed UrbRank Score per (city, profile) pair. Populated by
-- scripts/compute-urbrank-scores.ts from city_costs + city_demographics +
-- city_quality. Drives /should-i-move-to and /best-cities pages.
create table if not exists urbrank_scores (
  id                uuid primary key default gen_random_uuid(),
  city_id           uuid not null references cities(id) on delete cascade,
  profile           text not null,          -- general|family|retiree|remote_worker|young_professional
  score             numeric(5, 2) not null, -- 0.00-100.00
  grade             text not null,          -- A+, A, A-, B+, ...
  national_rank     integer,                -- 1..N within this profile
  dimension_scores  jsonb not null,         -- { affordability: 78, safety: 62, ... }
  computed_at       timestamptz not null default now(),
  unique (city_id, profile)
);

create index if not exists urbrank_scores_profile_score_idx on urbrank_scores (profile, score desc);
create index if not exists urbrank_scores_city_profile_idx on urbrank_scores (city_id, profile);

-- Row-level security -------------------------------------------------------
-- City data is public (Census + BLS). Allow anon SELECT on the read tables
-- so the Next.js client (using the anon key) can read them. `page_views` is
-- write-only via the service role key on the server; no anon policy.

alter table cities             enable row level security;
alter table city_costs         enable row level security;
alter table city_demographics  enable row level security;
alter table city_quality       enable row level security;
alter table comparisons_cache  enable row level security;
alter table page_views         enable row level security;
alter table urbrank_scores     enable row level security;

drop policy if exists "public read cities"            on cities;
drop policy if exists "public read city_costs"        on city_costs;
drop policy if exists "public read city_demographics" on city_demographics;
drop policy if exists "public read city_quality"      on city_quality;
drop policy if exists "public read comparisons_cache" on comparisons_cache;
drop policy if exists "public read urbrank_scores"    on urbrank_scores;

create policy "public read cities"            on cities            for select using (true);
create policy "public read city_costs"        on city_costs        for select using (true);
create policy "public read city_demographics" on city_demographics for select using (true);
create policy "public read city_quality"      on city_quality      for select using (true);
create policy "public read comparisons_cache" on comparisons_cache for select using (true);
create policy "public read urbrank_scores"    on urbrank_scores    for select using (true);
