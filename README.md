# LiveCost

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
| `/cost-of-living/[slug]` | Per-city profile (top 500 cities pre-rendered) |
| `/compare/[slugA]-vs-[slugB]` | Pairwise comparison (19,900 canonical pairs pre-rendered) |
| `/cheapest-cities/[state]` | State ranking (51 pages: 50 states + DC) |
| `/calculator` | Salary-equivalence calculator (URL-shareable query params) |
| `/sitemap.xml` | Sitemap index |
| `/robots.txt` | Crawler rules |
| `/api/pageview` | Pageview ingest endpoint |

## Prerequisites

- Node 20.9+ and npm
- A Supabase project (free tier works)
- API keys: [Census](https://api.census.gov/data/key_signup.html) and
  [BLS](https://data.bls.gov/registrationEngine/) (both free)

## Setup

```bash
git clone <your-fork>
cd livecost
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

Both ingest scripts are idempotent and upsert on `(city_id, year)`:

- `scripts/ingest-census.ts` pulls ACS 5-Year variables (income, rent, home
  value, age, education, poverty, commute) for the top 500 US places, plus
  the national median rent as the housing-index baseline.
- `scripts/ingest-bls.ts` pulls CPI-U for ~20 major metros (all items, food,
  housing, transportation, medical) and computes relative indices against the
  US city average, then merges into the same `city_costs` rows.

Re-run either script at any cadence — they fill the current target year.

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
