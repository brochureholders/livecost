-- LiveCost Supabase schema
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
  unique (city_id, year)
);

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
