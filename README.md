# UrbRank

Compare cost of living across US cities. Per-city profiles, side-by-side
comparisons, state rankings, and an interactive salary calculator, built on
real data from the US Census Bureau (ACS 5-Year) and the Bureau of Labor
Statistics (CPI-U).

## Stack

- **Next.js 16** (App Router, RSC, ISR)
- **TypeScript**, **Tailwind v4**
- **Supabase** (Postgres) for city data + pageview analytics
- **Recharts** for charts
- **DM Sans** via `next/font`

## Routes

| Path | What it is |
| --- | --- |
| `/` | Marketing home |
| `/cost-of-living/[slug]` | Per-city profile (1,000 cities pre-rendered) |
| `/should-i-move-to` + `/[slug]` | UrbRank Score landing + per-city radar (1,000 pre-rendered) |
| `/compare` + `/[slugA]-vs-[slugB]` | Comparison landing + 31k canonical pairs (top 250 cities) |
| `/calculator` | Salary-equivalence calculator (URL-shareable query params) |
| `/quiz` + `/results` | 8-question quiz that re-weights rankings to your priorities |
| `/best-cities` + `/[demographic]` + `/[state]` | Family / retiree / remote-worker / young-pro leaderboards |
| `/rankings` + `/[variant]` | Cheapest / priciest / highest-income / cheapest-rent national lists |
| `/cheapest-cities/[state]` | State cost ranking (50 states + DC) |
| `/blog` + `/[slug]` | 15 evergreen articles |
| `/about`, `/methodology`, `/privacy`, `/contact` | Static pages |
| `/admin` (Basic Auth) | Ad-block management panel (4 slots) |
| `/coverage` (noindex) | Internal data-coverage debug dashboard |
| `/sitemap.xml` + sub-sitemaps | Sitemap index, with sub-sitemaps for pages, states, cities, comparisons |
| `/robots.txt` | Crawler rules |
| `/api/pageview` | Pageview ingest endpoint (cookieless, no IP) |

## Prerequisites

- Node 20.9+ and npm
- A Supabase project (free tier works)
- API keys: [Census](https://api.census.gov/data/key_signup.html) and
  [BLS](https://data.bls.gov/registrationEngine/) (both free)

## Setup

```bash
git clone <your-fork>
cd urbrank
npm install
cp .env.example .env.local
# fill .env.local with real values
```

Run the schema against your Supabase database:

```bash
# Either paste the SQL into the Supabase SQL editor, or:
psql "$DATABASE_URL" -f scripts/setup-database.sql
```

Seed the data (takes a few minutes total):

```bash
npx tsx scripts/ingest-census.ts   # ~51 requests, populates 500 cities
npx tsx scripts/ingest-bls.ts      # ~3 requests, refines metro indices
```

Run the dev server:

```bash
npm run dev
# open http://localhost:3000
```

The app runs without Supabase — city pages will 404 and the calculator falls
back to six demo cities. Configure Supabase + run the ingest scripts to see
the full dataset.

## Environment variables

See `.env.example` for the full list with descriptions.

| Variable | Required for | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonicals, sitemap, robots | Set to deployed URL in prod |
| `NEXT_PUBLIC_SUPABASE_URL` | Reads | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Reads | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Ingest scripts, pageview API | Server-only, never client |
| `CENSUS_API_KEY` | `ingest-census.ts` | Free Census key |
| `BLS_API_KEY` | `ingest-bls.ts` | Free BLS key, 500 req/day |
| `API_DATA_GOV_KEY` | `ingest-crime.ts` | Free api.data.gov key; 1k req/hr |
| `WALKSCORE_API_KEY` | `ingest-walkscore.ts` | Free tier, 5k calls/day |
| `AQS_EMAIL` + `AQS_KEY` | `ingest-aqs.ts` | EPA AQS, free, paired credentials |
| `ADMIN_USER` + `ADMIN_PASSWORD` | `/admin` Basic Auth | Single-user, set in `.env.local` + Vercel |

## Build & deploy

```bash
npm run build
npm run start
```

### Vercel (recommended)

1. Push this repo to GitHub.
2. Import into Vercel; framework auto-detects as Next.js.
3. Add the environment variables from `.env.example` in the Vercel project
   settings. `NEXT_PUBLIC_SITE_URL` should be your Vercel URL (or a custom
   domain). `SUPABASE_SERVICE_ROLE_KEY` is server-only — do not expose it.
4. Deploy. ISR means pages rebuild daily; you don't need a redeploy for fresh
   DB rows.

### Other hosts

Any Node 20+ host that runs `next start` works. The OpenGraph image route
uses the Edge runtime — if your host doesn't support it, swap
`export const runtime = "edge"` → `"nodejs"` in `app/opengraph-image.tsx`.

## Data pipeline

All ingest scripts are idempotent and upsert on natural keys
(`(city_id, year)` or `slug`). Re-running fills any gaps without
disturbing existing data.

### Raw ingestion (one script per source)

- `scripts/ingest-census.ts` — ACS 5-Year income, rent, home value, age,
  education, poverty, commute for the top 1,000 US places.
- `scripts/ingest-bls.ts` — CPI-U for ~20 major metros (all items, food,
  housing, transportation, medical); used as the regional baseline.
- `scripts/ingest-bea-rpp.ts` — BEA Regional Price Parities for every CBSA,
  resolved via FCC reverse-geocode + Census CBSA crosswalk (committed in
  `data/census/county-to-cbsa.json`). 977/1000 cities authoritatively
  matched, the rest fall back to proximity.
- `scripts/ingest-walkscore.ts` — Walk Score / Transit Score / Bike Score.
- `scripts/ingest-weather-ncei.ts` + `ingest-weather.ts` — 30-year climate
  normals from NOAA NCEI with an Open-Meteo daily-archive fallback.
- `scripts/ingest-aqs.ts` — EPA AQS annual PM2.5 → AQI. Three-tier
  geographic fallback (city box → regional box → state mean).
- `scripts/ingest-crime.ts` — FBI Crime Data Explorer. Tries municipal PD
  first, falls back to the county sheriff (FCC + crosswalk) for CDPs and
  consolidated city-counties. Per-state persistence so a transient blip
  doesn't lose accumulated work.
- `scripts/fix-latlon-from-gazetteer.ts` — one-time fix for cities with
  bad lat/lon from earlier ingest runs.

### Derived

- `scripts/recompute-cost-indices.ts` — composes the five cost sub-indices
  into the headline `cost_index`.
- `scripts/compute-urbrank-scores.ts` — runs the 7-dimension scoring across
  all cities and writes `urbrank_scores` rows for the five profile weights.
- `scripts/audit-coverage.ts` — emits `data/coverage-report.json` with
  per-dimension fill rate, anomalies, and a diff vs the previous run.

### Orchestration

- `npm run refresh` — full pipeline (ingest → derive → audit).
- `npm run refresh:scores` — derive + audit only, skipping the slow ingest.
- `npm run refresh:audit` — just refresh the coverage report.
- `npm run retry:crime` — probe the FBI API; if up, run the ingest.
  Wrapped script for cron use.
- `npm run retry:crime:probe` — probe-only (no DB writes).

### Automation

`.github/workflows/refresh-crime.yml` runs `retry:crime` every 6 hours.
When the FBI API is healthy the ingest fires, the audit refreshes, and the
new `data/coverage-report.json` gets auto-committed back to `main` —
keeping the live `DataCompletenessBadge` and sitemap priorities accurate
without manual intervention.

## SEO

- Per-page `canonical` + `BreadcrumbList` / `FAQPage` / `ItemList` /
  `Organization` JSON-LD
- Sitemap index at `/sitemap.xml`; sub-sitemaps for pages, states, cities,
  and paginated comparisons
- Comparison pages canonicalize via `permanentRedirect` (alphabetical slug
  order) to avoid duplicate content

## Analytics

Every route posts to `/api/pageview` (using `navigator.sendBeacon` when
available), which inserts into the `page_views` table. No cookies, no PII.
Query your own data in the Supabase dashboard, e.g.:

```sql
select path, count(*) as views
from page_views
where created_at > now() - interval '7 days'
group by path
order by views desc
limit 20;
```

## Project layout

```
app/
  (routes…)
  api/pageview/route.ts         - pageview ingest
  api/sitemap-comparisons/…     - paginated comparison sitemap (via rewrite)
  sitemap*.xml/route.ts         - sitemap handlers
  opengraph-image.tsx           - dynamic OG card
  error.tsx / loading.tsx       - app-level fallbacks
components/
  profile/     compare/   ranking/   calculator/   analytics/
lib/
  supabase.ts       - client + row types
  cities.ts         - DB helpers (getCityBySlug, getTopCitySlugs, …)
  comparison.ts     - pair parsing + verdict math
  states.ts         - 50 + DC metadata
  site.ts           - SITE_URL / SITEMAP constants
  sitemap-utils.ts  - XML builders
  internal-links.ts - partner/same-state/similar-cost helpers
scripts/
  setup-database.sql
  ingest-census.ts
  ingest-bls.ts
```

## License

Proprietary — all rights reserved.
