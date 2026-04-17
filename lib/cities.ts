import { supabase, isSupabaseConfigured } from "./supabase";
import type {
  City,
  CityCosts,
  CityDemographics,
  CityQuality,
} from "./supabase";

export type CityProfile = City & {
  costs: CityCosts | null;
  demographics: CityDemographics | null;
  quality: CityQuality | null;
};

export type CitySummary = Pick<
  City,
  "id" | "name" | "slug" | "state" | "state_code" | "population"
> & {
  cost_index: number | null;
  median_rent: number | null;
  median_household_income: number | null;
};

export type CityOption = {
  slug: string;
  name: string;
  state: string;
  state_code: string;
  cost_index: number | null;
  housing_index: number | null;
  grocery_index: number | null;
  utilities_index: number | null;
  transportation_index: number | null;
  healthcare_index: number | null;
};

/** Small set of approximate city indices used when Supabase is not yet seeded,
 *  so the calculator still functions in local dev. Replaced by real data
 *  after `ingest-census.ts` + `ingest-bls.ts` run. */
const DEMO_OPTIONS: CityOption[] = [
  { slug: "new-york-ny", name: "New York", state: "New York", state_code: "NY",
    cost_index: 170, housing_index: 220, grocery_index: 115, utilities_index: 115,
    transportation_index: 115, healthcare_index: 100 },
  { slug: "san-francisco-ca", name: "San Francisco", state: "California", state_code: "CA",
    cost_index: 172, housing_index: 230, grocery_index: 115, utilities_index: 110,
    transportation_index: 120, healthcare_index: 110 },
  { slug: "austin-tx", name: "Austin", state: "Texas", state_code: "TX",
    cost_index: 118, housing_index: 125, grocery_index: 95, utilities_index: 100,
    transportation_index: 100, healthcare_index: 98 },
  { slug: "chicago-il", name: "Chicago", state: "Illinois", state_code: "IL",
    cost_index: 107, housing_index: 110, grocery_index: 100, utilities_index: 100,
    transportation_index: 110, healthcare_index: 100 },
  { slug: "denver-co", name: "Denver", state: "Colorado", state_code: "CO",
    cost_index: 122, housing_index: 135, grocery_index: 100, utilities_index: 95,
    transportation_index: 105, healthcare_index: 105 },
  { slug: "nashville-tn", name: "Nashville", state: "Tennessee", state_code: "TN",
    cost_index: 103, housing_index: 108, grocery_index: 95, utilities_index: 95,
    transportation_index: 100, healthcare_index: 95 },
];

/** Pick the row with the highest `year`, or null if none. */
function latest<T extends { year: number }>(rows: T[] | null | undefined): T | null {
  if (!rows || rows.length === 0) return null;
  return [...rows].sort((a, b) => b.year - a.year)[0];
}

export async function getCityBySlug(slug: string): Promise<CityProfile | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("cities")
    .select(
      `
      *,
      city_costs(*),
      city_demographics(*),
      city_quality(*)
    `,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as City & {
    city_costs: CityCosts[] | null;
    city_demographics: CityDemographics[] | null;
    city_quality: CityQuality[] | null;
  };

  return {
    ...row,
    costs: latest(row.city_costs),
    demographics: latest(row.city_demographics),
    quality: latest(row.city_quality),
  };
}

export async function getTopCitySlugs(limit: number): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("cities")
    .select("slug, population")
    .order("population", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((r) => r.slug as string);
}

export async function getCityOptions(limit = 500): Promise<CityOption[]> {
  if (!isSupabaseConfigured) return DEMO_OPTIONS;
  const { data, error } = await supabase
    .from("cities")
    .select(
      `
      slug, name, state, state_code, population,
      city_costs(year, cost_index, housing_index, grocery_index, utilities_index, transportation_index, healthcare_index)
    `,
    )
    .order("population", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !data || data.length === 0) return DEMO_OPTIONS;

  const mapped: CityOption[] = data
    .map((row) => {
      const costs = (row.city_costs ?? []) as Pick<
        CityCosts,
        | "year"
        | "cost_index"
        | "housing_index"
        | "grocery_index"
        | "utilities_index"
        | "transportation_index"
        | "healthcare_index"
      >[];
      const l = latest(costs);
      return {
        slug: row.slug as string,
        name: row.name as string,
        state: row.state as string,
        state_code: row.state_code as string,
        cost_index: l?.cost_index ?? null,
        housing_index: l?.housing_index ?? null,
        grocery_index: l?.grocery_index ?? null,
        utilities_index: l?.utilities_index ?? null,
        transportation_index: l?.transportation_index ?? null,
        healthcare_index: l?.healthcare_index ?? null,
      };
    })
    .filter((o) => o.cost_index != null);

  return mapped.length > 0 ? mapped : DEMO_OPTIONS;
}

export async function getTopCitiesExcluding(
  excludeIds: string[],
  limit = 10,
): Promise<CitySummary[]> {
  if (!isSupabaseConfigured) return [];
  let query = supabase
    .from("cities")
    .select(
      `
      id, name, slug, state, state_code, population,
      city_costs(year, cost_index, median_rent, median_household_income)
    `,
    )
    .order("population", { ascending: false, nullsFirst: false })
    .limit(limit + excludeIds.length);
  if (excludeIds.length > 0) query = query.not("id", "in", `(${excludeIds.join(",")})`);
  const { data, error } = await query;
  if (error || !data) return [];
  return data.slice(0, limit).map((row) => {
    const costs = (row.city_costs ?? []) as Pick<
      CityCosts,
      "year" | "cost_index" | "median_rent" | "median_household_income"
    >[];
    const latestCosts = latest(costs);
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      state: row.state as string,
      state_code: row.state_code as string,
      population: row.population as number | null,
      cost_index: latestCosts?.cost_index ?? null,
      median_rent: latestCosts?.median_rent ?? null,
      median_household_income: latestCosts?.median_household_income ?? null,
    };
  });
}

export async function getCitiesByState(
  stateCode: string,
  limit = 500,
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
    .eq("state_code", stateCode)
    .order("population", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => {
    const costs = (row.city_costs ?? []) as Pick<
      CityCosts,
      "year" | "cost_index" | "median_rent" | "median_household_income"
    >[];
    const latestCosts = latest(costs);
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      state: row.state as string,
      state_code: row.state_code as string,
      population: row.population as number | null,
      cost_index: latestCosts?.cost_index ?? null,
      median_rent: latestCosts?.median_rent ?? null,
      median_household_income: latestCosts?.median_household_income ?? null,
    };
  });
}

export async function getOtherCitiesInState(
  stateCode: string,
  excludeId: string,
  limit = 12,
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
    .eq("state_code", stateCode)
    .neq("id", excludeId)
    .order("population", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => {
    const costs = (row.city_costs ?? []) as Pick<
      CityCosts,
      "year" | "cost_index" | "median_rent" | "median_household_income"
    >[];
    const latestCosts = latest(costs);
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      state: row.state as string,
      state_code: row.state_code as string,
      population: row.population as number | null,
      cost_index: latestCosts?.cost_index ?? null,
      median_rent: latestCosts?.median_rent ?? null,
      median_household_income: latestCosts?.median_household_income ?? null,
    };
  });
}
