import type { CityQuality } from "@/lib/supabase";

type Props = { quality: CityQuality | null };

export default function QualityOfLife({ quality }: Props) {
  if (!quality) return null;

  const climate = {
    summer: quality.avg_temp_summer,
    winter: quality.avg_temp_winter,
    precipitation: quality.annual_precipitation,
    sunshine: quality.sunshine_days,
  };
  const hasClimate = Object.values(climate).some((v) => v != null);

  const hasSafety =
    quality.crime_rate_per_100k != null ||
    quality.violent_crime_rate != null ||
    quality.property_crime_rate != null;

  const hasWalk =
    quality.walk_score != null ||
    quality.transit_score != null ||
    quality.bike_score != null ||
    quality.air_quality_index != null;

  if (!hasClimate && !hasSafety && !hasWalk) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {hasClimate && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
            Climate
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            {climate.summer != null && (
              <li className="flex justify-between">
                <span className="text-[var(--muted)]">Summer avg</span>
                <span className="tabular-nums">
                  {climate.summer.toFixed(0)}°F
                </span>
              </li>
            )}
            {climate.winter != null && (
              <li className="flex justify-between">
                <span className="text-[var(--muted)]">Winter avg</span>
                <span className="tabular-nums">
                  {climate.winter.toFixed(0)}°F
                </span>
              </li>
            )}
            {climate.precipitation != null && (
              <li className="flex justify-between">
                <span className="text-[var(--muted)]">Annual rainfall</span>
                <span className="tabular-nums">
                  {climate.precipitation.toFixed(0)}"
                </span>
              </li>
            )}
            {climate.sunshine != null && (
              <li className="flex justify-between">
                <span className="text-[var(--muted)]">Sunny days</span>
                <span className="tabular-nums">{climate.sunshine} / yr</span>
              </li>
            )}
          </ul>
        </div>
      )}

      {hasSafety && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
            Safety
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            {quality.crime_rate_per_100k != null && (
              <li className="flex justify-between">
                <span className="text-[var(--muted)]">Crime per 100k</span>
                <span className="tabular-nums">
                  {Math.round(quality.crime_rate_per_100k).toLocaleString()}
                </span>
              </li>
            )}
            {quality.violent_crime_rate != null && (
              <li className="flex justify-between">
                <span className="text-[var(--muted)]">Violent crime</span>
                <span className="tabular-nums">
                  {quality.violent_crime_rate.toFixed(1)}
                </span>
              </li>
            )}
            {quality.property_crime_rate != null && (
              <li className="flex justify-between">
                <span className="text-[var(--muted)]">Property crime</span>
                <span className="tabular-nums">
                  {quality.property_crime_rate.toFixed(1)}
                </span>
              </li>
            )}
          </ul>
        </div>
      )}

      {hasWalk && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
            Livability
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            {quality.walk_score != null && (
              <li className="flex justify-between">
                <span className="text-[var(--muted)]">Walk Score</span>
                <span className="tabular-nums">{quality.walk_score} / 100</span>
              </li>
            )}
            {quality.transit_score != null && (
              <li className="flex justify-between">
                <span className="text-[var(--muted)]">Transit Score</span>
                <span className="tabular-nums">
                  {quality.transit_score} / 100
                </span>
              </li>
            )}
            {quality.bike_score != null && (
              <li className="flex justify-between">
                <span className="text-[var(--muted)]">Bike Score</span>
                <span className="tabular-nums">{quality.bike_score} / 100</span>
              </li>
            )}
            {quality.air_quality_index != null && (
              <li className="flex justify-between">
                <span className="text-[var(--muted)]">Air quality (AQI)</span>
                <span className="tabular-nums">
                  {Math.round(quality.air_quality_index)}
                </span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
