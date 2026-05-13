import type { CityProfile } from "@/lib/cities";
import { getElevationFeet, getElevationMeters } from "@/lib/elevation";
import { isHurricaneRelevant } from "@/lib/hurricane";

type Props = { city: CityProfile };

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// ---------------------------------------------------------------------------
// Answer generators — each returns a short paragraph or null when the data
// needed is missing. Keep them honest with their own data. Each answer
// repeats the city name at least once so the H2 question + paragraph block
// reads naturally as a featured-snippet candidate.
// ---------------------------------------------------------------------------

function snowAnswer(name: string, winterTemp: number | null): string | null {
  if (winterTemp == null) return null;
  if (winterTemp < 25)
    return `Yes, ${name} sees significant snow each winter. The average winter temperature is about ${winterTemp.toFixed(0)}°F — cold enough for regular accumulation from December through February.`;
  if (winterTemp < 35)
    return `Yes, ${name} gets meaningful snow most winters. The average winter temperature is about ${winterTemp.toFixed(0)}°F, cold enough for several days of accumulation a year.`;
  if (winterTemp < 45)
    return `Occasionally. ${name} averages around ${winterTemp.toFixed(0)}°F in winter — most precipitation falls as rain, but a few snow days a year are normal.`;
  if (winterTemp < 55)
    return `Rarely. ${name} is mild in winter (averaging about ${winterTemp.toFixed(0)}°F) — flurries are possible once or twice a year, but accumulation is unusual.`;
  return `No, ${name} is too warm for snow. Winter averages around ${winterTemp.toFixed(0)}°F, well above freezing.`;
}

function coldAnswer(name: string, winterTemp: number | null): string | null {
  if (winterTemp == null) return null;
  return `The average winter temperature in ${name} is about ${winterTemp.toFixed(0)}°F (covering December, January, and February). Individual nights can run colder, especially in cold-snap conditions, but the seasonal average gives the best single-number picture of typical winter weather.`;
}

function hotAnswer(name: string, summerTemp: number | null): string | null {
  if (summerTemp == null) return null;
  return `The average summer temperature in ${name} is about ${summerTemp.toFixed(0)}°F (June through August). Heat-wave days can run noticeably hotter; this is the seasonal average, not the peak.`;
}

function sunnyAnswer(name: string, sunshineDays: number | null): string | null {
  if (sunshineDays == null) return null;
  const US_AVG = 205;
  const diff = sunshineDays - US_AVG;
  const comparison =
    Math.abs(diff) < 15
      ? `about the same as the US average of ${US_AVG}`
      : diff > 0
        ? `above the US average of ${US_AVG}`
        : `below the US average of ${US_AVG}`;
  return `${name} averages about ${Math.round(sunshineDays)} sunny days per year — ${comparison}.`;
}

/** USDA Hardiness Zone approximated from winter average. Real USDA zones
 *  are based on the absolute annual minimum temperature, typically ~15°F
 *  colder than the 3-month winter average we have. Subtracting 15°F gets
 *  us close enough to band correctly; we caveat the approximation. */
function growingZoneAnswer(
  name: string,
  winterTemp: number | null,
): string | null {
  if (winterTemp == null) return null;
  const absMin = winterTemp - 15;
  let zone: string;
  if (absMin < -30) zone = "3";
  else if (absMin < -20) zone = "4";
  else if (absMin < -10) zone = "5";
  else if (absMin < 0) zone = "6";
  else if (absMin < 10) zone = "7";
  else if (absMin < 20) zone = "8";
  else if (absMin < 30) zone = "9";
  else if (absMin < 40) zone = "10";
  else zone = "11";
  return `${name} is approximately USDA Hardiness Zone ${zone}. Hardiness zones are based on the average annual minimum temperature — gardeners use them to pick plants that will survive local winters. This estimate is derived from our winter-temperature data; the official USDA map uses station-level minimums and may differ by half a zone.`;
}

function safetyAnswer(
  name: string,
  crimeRate: number | null,
): string | null {
  if (crimeRate == null) return null;
  const r = Math.round(crimeRate).toLocaleString();
  if (crimeRate < 2000)
    return `Yes, by the numbers. ${name}'s reported crime rate is about ${r} incidents per 100,000 residents — notably below the US average of around 3,500 per 100k. Like any city, specific neighborhoods vary.`;
  if (crimeRate < 4000)
    return `${name}'s reported crime rate is about ${r} per 100,000 residents — roughly in line with the US average (about 3,500 per 100k). Safety varies by neighborhood; check specific areas before making a decision.`;
  if (crimeRate < 6000)
    return `${name}'s reported crime rate is about ${r} per 100,000 residents — above the US average of around 3,500 per 100k. The headline number masks wide variation between neighborhoods.`;
  return `${name}'s reported crime rate is high at about ${r} per 100,000 residents — well above the US average of around 3,500 per 100k. Specific neighborhoods vary widely; the city-wide rate is dragged up by a few hotspots in most places.`;
}

function expensiveAnswer(
  name: string,
  costIndex: number | null,
): string | null {
  if (costIndex == null) return null;
  if (costIndex < 90)
    return `No — ${name} is more affordable than the average US city. The composite cost-of-living index is ${costIndex.toFixed(0)} (100 = US average), about ${(100 - costIndex).toFixed(0)}% below the national baseline. Housing usually drives most of the discount.`;
  if (costIndex < 110)
    return `${name} sits near the US average for cost of living. The composite index is ${costIndex.toFixed(0)} where 100 is the national baseline — housing, groceries, and utilities are roughly typical for a US city.`;
  if (costIndex < 130)
    return `Yes, ${name} is more expensive than the average US city. The cost-of-living index is ${costIndex.toFixed(0)}, about ${(costIndex - 100).toFixed(0)}% above the national baseline. Housing is usually the dominant factor.`;
  return `Yes, ${name} is significantly more expensive than the average US city. The cost-of-living index is ${costIndex.toFixed(0)} — about ${(costIndex - 100).toFixed(0)}% above the national baseline. Housing drives most of the gap; salaries usually need to scale similarly for purchasing power to hold.`;
}

function walkableAnswer(
  name: string,
  walkScore: number | null,
  transitScore: number | null,
): string | null {
  if (walkScore == null) return null;
  let band: string;
  if (walkScore < 25) band = "Walker's Hostile";
  else if (walkScore < 50) band = "Car-Dependent";
  else if (walkScore < 70) band = "Somewhat Walkable";
  else if (walkScore < 90) band = "Very Walkable";
  else band = "Walker's Paradise";
  const carHint =
    walkScore < 50
      ? `Most residents need a car for daily errands.`
      : walkScore < 70
        ? `You can do many errands on foot, but a car is still useful for longer trips.`
        : `You can comfortably live without a car for most daily needs.`;
  const transitFragment =
    transitScore != null
      ? ` Transit Score is ${transitScore} out of 100.`
      : "";
  return `${name}'s Walk Score is ${walkScore} out of 100 — classified as "${band}".${transitFragment} ${carHint}`;
}

/** Adaptive elevation answer — leads with "below sea level" framing for
 *  coastal cities (Miami gets 640mo on "is Miami below sea level"), and
 *  flags the "Mile High" tier for genuinely high cities. */
function elevationAnswer(
  name: string,
  elevFt: number | null,
  elevM: number | null,
): string | null {
  if (elevFt == null || elevM == null) return null;
  const fmt = (n: number) => n.toLocaleString();
  if (elevFt <= 20) {
    return `${name} sits at about ${fmt(elevFt)} feet (${fmt(elevM)} m) above sea level — barely above the waterline. Storm surge and sea-level rise are meaningful concerns for low-lying coastal cities like this one.`;
  }
  if (elevFt < 500) {
    return `${name} is at about ${fmt(elevFt)} feet (${fmt(elevM)} m) above sea level — low-lying but not coastal.`;
  }
  if (elevFt < 1500) {
    return `${name} sits at about ${fmt(elevFt)} feet (${fmt(elevM)} m) above sea level.`;
  }
  if (elevFt < 3500) {
    return `${name} is at about ${fmt(elevFt)} feet (${fmt(elevM)} m) above sea level — meaningfully higher than coastal cities but not enough to noticeably affect breathing or cooking.`;
  }
  if (elevFt < 5500) {
    return `${name} is at about ${fmt(elevFt)} feet (${fmt(elevM)} m) above sea level — high enough that visitors from sea level sometimes notice mild altitude effects (shorter breath, faster dehydration) for the first few days.`;
  }
  return `${name} sits at about ${fmt(elevFt)} feet (${fmt(elevM)} m) above sea level. At this altitude, expect noticeable initial adjustment: shorter breath, faster dehydration, and longer cooking times. Most people acclimate within a week.`;
}

function hurricaneAnswer(name: string): string {
  return `Atlantic hurricane season runs June 1 through November 30, with peak activity from mid-August through October. For ${name}, that's when to watch the National Hurricane Center forecast cone and have an evacuation plan if you live in a low-lying or coastal area.`;
}

function salaryAnswer(
  name: string,
  costIndex: number | null,
  medianRent: number | null,
): string | null {
  if (costIndex == null) return null;
  const recommendedSalary = Math.round(70_000 * (costIndex / 100));
  const rentLine =
    medianRent != null
      ? ` Median rent in ${name} is ${CURRENCY.format(medianRent)}/mo, so keeping housing under 30% of gross income points to a similar floor.`
      : "";
  return `To match the lifestyle of a ${CURRENCY.format(70_000)} earner in an average US city, you'd need about ${CURRENCY.format(recommendedSalary)} per year in ${name}.${rentLine}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FAQ({ city }: Props) {
  const q = city.quality;
  const c = city.costs;

  const elevFt = getElevationFeet(city.slug);
  const elevM = getElevationMeters(city.slug);
  const hurricaneRelevant = isHurricaneRelevant(city.state_code, city.longitude);

  // Build all candidate Q&As, then filter out ones without data.
  const candidates: { q: string; a: string | null }[] = [
    { q: `Does it snow in ${city.name}?`, a: snowAnswer(city.name, q?.avg_temp_winter ?? null) },
    { q: `How cold does ${city.name} get in winter?`, a: coldAnswer(city.name, q?.avg_temp_winter ?? null) },
    { q: `How hot does ${city.name} get in summer?`, a: hotAnswer(city.name, q?.avg_temp_summer ?? null) },
    { q: `How many sunny days does ${city.name} have?`, a: sunnyAnswer(city.name, q?.sunshine_days ?? null) },
    { q: `What USDA growing zone is ${city.name} in?`, a: growingZoneAnswer(city.name, q?.avg_temp_winter ?? null) },
    { q: `What is the elevation of ${city.name}?`, a: elevationAnswer(city.name, elevFt, elevM) },
    ...(hurricaneRelevant
      ? [{ q: `When is hurricane season in ${city.name}?`, a: hurricaneAnswer(city.name) }]
      : []),
    { q: `Is ${city.name} safe?`, a: safetyAnswer(city.name, q?.crime_rate_per_100k ?? null) },
    { q: `Is ${city.name} expensive to live in?`, a: expensiveAnswer(city.name, c?.cost_index ?? null) },
    { q: `Is ${city.name} walkable?`, a: walkableAnswer(city.name, q?.walk_score ?? null, q?.transit_score ?? null) },
    { q: `What salary do you need to live in ${city.name}?`, a: salaryAnswer(city.name, c?.cost_index ?? null, c?.median_rent ?? null) },
  ];
  const items = candidates.filter((x): x is { q: string; a: string } => x.a != null);

  if (items.length === 0) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <div>
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
        Frequently asked about {city.name}
      </h2>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mt-6 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {items.map((item, i) => (
          <details key={i} className="group p-6" open={i < 2}>
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
              <h3 className="text-base md:text-lg font-semibold tracking-tight">
                {item.q}
              </h3>
              <span
                aria-hidden
                className="mt-1 text-[var(--muted)] transition-transform group-open:rotate-45 shrink-0"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-sm md:text-base leading-relaxed text-[var(--muted)]">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
