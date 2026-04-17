import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const urlOk = !!supabaseUrl && /^https?:\/\//.test(supabaseUrl);
const keyOk = !!supabaseAnonKey && supabaseAnonKey !== "your-supabase-anon-key-here";

export const isSupabaseConfigured = urlOk && keyOk;

if (!isSupabaseConfigured) {
  console.warn(
    "[supabase] env vars look like placeholders — queries will short-circuit and return empty. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local / your deployment env.",
  );
}

export const supabase = createClient(
  urlOk ? supabaseUrl! : "https://placeholder.supabase.co",
  keyOk ? supabaseAnonKey! : "placeholder-anon-key",
);

export type City = {
  id: string;
  name: string;
  state: string;
  state_code: string;
  slug: string;
  fips_code: string | null;
  population: number | null;
  latitude: number | null;
  longitude: number | null;
  metro_area: string | null;
  created_at: string;
};

export type CityCosts = {
  id: string;
  city_id: string;
  year: number;
  median_household_income: number | null;
  median_home_value: number | null;
  median_rent: number | null;
  cost_index: number | null;
  grocery_index: number | null;
  housing_index: number | null;
  utilities_index: number | null;
  transportation_index: number | null;
  healthcare_index: number | null;
  data_source: string | null;
  updated_at: string;
};

export type CityDemographics = {
  id: string;
  city_id: string;
  year: number;
  median_age: number | null;
  unemployment_rate: number | null;
  poverty_rate: number | null;
  college_educated_pct: number | null;
  commute_time_avg: number | null;
  population_growth_pct: number | null;
};

export type CityQuality = {
  id: string;
  city_id: string;
  year: number;
  crime_rate_per_100k: number | null;
  violent_crime_rate: number | null;
  property_crime_rate: number | null;
  avg_temp_summer: number | null;
  avg_temp_winter: number | null;
  annual_precipitation: number | null;
  sunshine_days: number | null;
  air_quality_index: number | null;
  walk_score: number | null;
};
