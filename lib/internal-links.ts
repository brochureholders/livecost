import { supabase, isSupabaseConfigured } from "./supabase";
import type { CityCosts } from "./supabase";
import type { CityProfile, CitySummary } from "./cities";
import { getOtherCitiesInState } from "./cities";

function latest<T extends { year: number }>(rows: T[] | null | undefined): T | null {
  if (!rows || rows.length === 0) return null;
  return [...rows].sort((a, b) => b.year - a.year)[0];
}

function toSummary(row: {
  id: string;
  name: string;
  slug: string;
  state: string;
  state_code: string;
  population: number | null;
  city_costs?:
    | Pick<CityCosts, "year" | "cost_index" | "median_rent" | "median_household_income">[]
    | null;
}): CitySummary {
  const latestCosts = latest(row.city_costs ?? []);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    state: row.state,
    state_code: row.state_code,
    population: row.population,
    cost_index: latestCosts?.cost_index ?? null,
    median_rent: latestCosts?.median_rent ?? null,
    median_household_income: latestCosts?.median_household_income ?? null,
  };
}

/** Top comparison partners for a city: largest metros from *other* states,
 *  so the resulting pairs span the country rather than clustering locally. */
export async function getComparisonPartners(
  city: CityProfile,
  limit = 10,
): Promise<CitySummary[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("cities")
    .select(
      `
      id, name, slug, state, state_code, population,
      city_costs(year, cost_index, median_rent, median_household_income)
    `,
    )
    .neq("state_code", city.state_code)
    .order("population", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row) =>
    toSummary(row as Parameters<typeof toSummary>[0]),
  );
}

/** Re-exported for discoverability from the same helper module. */
export const getCitiesInSameState = getOtherCitiesInState;

/** Cities whose cost_index is within ±`range` of the anchor city's cost_index,
 *  sorted by proximity (closest first). Fetches all cities (Supabase default
 *  1000-row cap is fine since our DB has 500) so the filter isn't starved. */
export async function getSimilarCostCities(
  city: CityProfile,
  range = 10,
  limit = 5,
): Promise<CitySummary[]> {
  if (!isSupabaseConfigured) return [];
  const anchor = city.costs?.cost_index;
  if (anchor == null) return [];

  const lower = anchor - range;
  const upper = anchor + range;

  const { data, error } = await supabase
    .from("cities")
    .select(
      `
      id, name, slug, state, state_code, population,
      city_costs(year, cost_index, median_rent, median_household_income)
    `,
    )
    .neq("id", city.id)
    .range(0, 999);

  if (error || !data) return [];

  return data
    .map((row) => toSummary(row as Parameters<typeof toSummary>[0]))
    .filter(
      (c) =>
        c.cost_index != null && c.cost_index >= lower && c.cost_index <= upper,
    )
    .sort((a, b) => {
      const da = Math.abs((a.cost_index ?? 0) - anchor);
      const db = Math.abs((b.cost_index ?? 0) - anchor);
      return da - db;
    })
    .slice(0, limit);
}
