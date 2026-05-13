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
// Determinism helper — pick one of several phrasings based on a stable hash
// of the city slug, so each city gets a unique-feeling answer but the same
// city always renders the same text.
// ---------------------------------------------------------------------------
function hashSlug(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h * 31) + seed.charCodeAt(i)) >>> 0;
  return h;
}
function pick<T>(seed: string, variants: T[], offset = 0): T {
  return variants[(hashSlug(seed) + offset) % variants.length];
}

// ---------------------------------------------------------------------------
// Answer generators — written for readability, not as templates. Each band
// has a handful of phrasings; the per-city hash picks one so the catalog as
// a whole doesn't read like a mail merge.
// ---------------------------------------------------------------------------

function snowAnswer(slug: string, name: string, winterTemp: number | null): string | null {
  if (winterTemp == null) return null;
  const t = winterTemp.toFixed(0);
  if (winterTemp < 25) {
    return pick(slug, [
      `Snow is just part of the winter in ${name}. Average temperatures around ${t}°F mean the ground stays covered from December well into March, and a snowblower is less optional than aspirational.`,
      `Yes — and a lot of it. With winter averages near ${t}°F, ${name} sees real accumulation most years. Salt for the steps, tires that handle ice, and a sense of humor about February are the usual costs of admission.`,
      `${name} does winter the real way. Averages around ${t}°F keep snow on the ground for weeks at a time, and lakes and rivers tend to freeze hard enough to walk on.`,
    ]);
  }
  if (winterTemp < 35) {
    return pick(slug, [
      `Yes, several times a winter. ${name}'s winter average of about ${t}°F sits right around freezing, so storms typically drop real snow that lingers a few days before slush sets in.`,
      `${name} gets a handful of meaningful snow days each year. Winters average about ${t}°F — cold enough for several inches at a time, warm enough for everything to melt between storms.`,
      `Snow is a regular feature, not a surprise. With winter temperatures hovering near ${t}°F, ${name} sees enough snowfall that locals don't think twice about it but also enough mild stretches that nobody owns three pairs of boots.`,
    ]);
  }
  if (winterTemp < 45) {
    return pick(slug, [
      `Now and then. ${name}'s winters are cool rather than truly cold — about ${t}°F on average — so most of the precipitation falls as rain. A snowy morning happens a few times a season; sustained accumulation is rare.`,
      `Not really a snow town. With winters averaging ${t}°F, ${name} sits in the mild-cold band where snowflakes appear occasionally and everything melts within a day. Most years see one storm worth talking about.`,
    ]);
  }
  if (winterTemp < 55) {
    return pick(slug, [
      `Almost never. ${name}'s winter average of about ${t}°F is too warm for snow most years. A measurable snowfall is the kind of event that closes schools and gets photographed for the local paper.`,
      `It's rare. Winters in ${name} run about ${t}°F — cold-snap mornings happen, real snowfall doesn't, except maybe once a decade.`,
    ]);
  }
  return pick(slug, [
    `No. Winter in ${name} averages about ${t}°F — jacket weather, not coat weather. Snow on the actual city is essentially unheard-of.`,
    `It doesn't. With winter temperatures around ${t}°F, ${name} is too warm for snow as a regular occurrence. The closest most residents get is on a trip to the mountains.`,
    `Snow isn't part of the local weather. Average winter temperatures sit around ${t}°F, comfortably above freezing through the whole season.`,
  ]);
}

function coldAnswer(slug: string, name: string, winterTemp: number | null): string | null {
  if (winterTemp == null) return null;
  const t = winterTemp.toFixed(0);
  if (winterTemp < 25) {
    return pick(slug, [
      `Cold enough to plan around. Winter in ${name} averages roughly ${t}°F, with stretches where daytime highs don't break freezing for weeks. Decent insulation, a real coat, and a car that starts in cold weather are non-negotiable.`,
      `Properly cold. ${name}'s winter sits around ${t}°F on average — and that's the average, meaning plenty of nights drop well below zero. People here own gear.`,
    ]);
  }
  if (winterTemp < 35) {
    return pick(slug, [
      `Cold but workable. Winter in ${name} averages about ${t}°F — colder than the national norm, mild compared to the upper Midwest. A solid coat handles most days; the genuine cold snaps are short.`,
      `A real winter, but not a punishing one. ${name} averages roughly ${t}°F in winter, with the coldest mornings dipping into the single digits a few times a year and most days landing somewhere between "chilly" and "actually cold".`,
    ]);
  }
  if (winterTemp < 45) {
    return pick(slug, [
      `Mild on the cold side. ${name}'s winter average of about ${t}°F is the kind of weather where you want a jacket but the heating bill is manageable. Snow is rare, frost is occasional, and the lawn never really browns out.`,
      `Cool, not cold. Winters in ${name} sit around ${t}°F — sweater-and-jacket weather most days, with the occasional cold front that reminds you it's still winter.`,
    ]);
  }
  if (winterTemp < 55) {
    return pick(slug, [
      `Barely. Winter in ${name} averages around ${t}°F — short, mild, mostly an excuse to break out a light jacket. Some plants don't even drop their leaves.`,
      `Not very. Average winter temperatures of about ${t}°F mean ${name} skips the harsh-winter problem most of the country has. A handful of cold mornings, otherwise sweater weather at worst.`,
    ]);
  }
  return pick(slug, [
    `It doesn't, really. Winter in ${name} runs about ${t}°F on average — closer to spring than to the kind of winter most of the country gets. A light layer most days, shorts on the warm afternoons.`,
    `${name} skips winter as the rest of the country knows it. Averages around ${t}°F mean a jacket is the most you'll need, and that's mainly in the evenings.`,
  ]);
}

function hotAnswer(slug: string, name: string, summerTemp: number | null): string | null {
  if (summerTemp == null) return null;
  const t = summerTemp.toFixed(0);
  if (summerTemp >= 90) {
    return pick(slug, [
      `Genuinely hot. Summer in ${name} averages about ${t}°F, and peak afternoons run well over a hundred. Outdoor plans move to mornings and evenings; AC is the most-used appliance in the house.`,
      `Properly hot. ${name}'s summer averages around ${t}°F with daily highs that routinely break 100°F. The trick to summer here is starting the day at sunrise and staying inside through the worst of it.`,
    ]);
  }
  if (summerTemp >= 80) {
    return pick(slug, [
      `Hot, but not desert-hot. Summer in ${name} runs about ${t}°F on average, with afternoons in the 90s and humidity that varies by region. AC is standard rather than optional.`,
      `Reliably warm. ${name}'s summer averages around ${t}°F, the kind of heat where you remember to leave the house before noon for outdoor things and accept that the back of your shirt will be wet by lunchtime.`,
    ]);
  }
  if (summerTemp >= 70) {
    return pick(slug, [
      `Pleasantly warm. ${name}'s summer averages around ${t}°F — comfortable for outdoor evenings, hot enough on peak days to warrant AC but mild compared to the Sun Belt.`,
      `Warm without being brutal. Summer in ${name} sits about ${t}°F on average. Afternoons can push into the high 80s, but mornings and evenings are usually genuinely pleasant.`,
    ]);
  }
  return pick(slug, [
    `Mild. Summer in ${name} averages only about ${t}°F — short-sleeve weather, but rarely the kind of heat that ruins plans. Many homes don't bother with AC.`,
    `${name} skips real summer heat. With averages around ${t}°F, the season is more "long days and t-shirts" than "outdoor work canceled by 11am".`,
  ]);
}

function sunnyAnswer(slug: string, name: string, sunshineDays: number | null): string | null {
  if (sunshineDays == null) return null;
  const d = Math.round(sunshineDays);
  const US_AVG = 205;
  const diff = d - US_AVG;
  if (diff > 50) {
    return pick(slug, [
      `${name} gets about ${d} sunny days a year — well above the US average of around ${US_AVG}. If your mood tracks daylight, this is one of the easier US cities to live in.`,
      `Plenty. About ${d} sunny days a year in ${name} — significantly more than the national average of ${US_AVG}. Cloudy weeks are the exception, not the rule.`,
    ]);
  }
  if (diff > 15) {
    return pick(slug, [
      `${name} averages about ${d} sunny days a year, a comfortable margin above the US average of ${US_AVG}. Patio season is long.`,
      `Above average. ${name} sees roughly ${d} sunny days annually versus the ${US_AVG}-day national norm — enough sun that gray stretches feel notable when they happen.`,
    ]);
  }
  if (diff > -15) {
    return pick(slug, [
      `About ${d} sunny days a year — close enough to the US average of ${US_AVG} that ${name} feels normal on this dimension. Neither dramatically sunny nor dramatically gray.`,
      `Roughly average. ${name} averages around ${d} sunny days a year, right in line with the rest of the country.`,
    ]);
  }
  if (diff > -50) {
    return pick(slug, [
      `Somewhat below the national norm — about ${d} sunny days a year in ${name} versus the US average of ${US_AVG}. Cloud cover is part of the local character, especially in winter.`,
      `${name} gets about ${d} sunny days annually, modestly under the US average. The trade-off is usually less heat in summer and milder winters than the sunnier alternatives.`,
    ]);
  }
  return pick(slug, [
    `${name} is notably cloudy — only about ${d} sunny days a year compared to the ${US_AVG}-day US average. SAD lamps and rain gear sell well.`,
    `On the gray end. ${name} averages roughly ${d} sunny days annually, well under the national norm. Bring layers, an umbrella, and patience.`,
  ]);
}

function growingZoneAnswer(slug: string, name: string, winterTemp: number | null): string | null {
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
  return pick(slug, [
    `Approximately USDA Hardiness Zone ${zone}. That's the band gardeners use to pick plants — anything rated for Zone ${zone} or colder should survive a typical winter in ${name}. (The estimate is derived from our winter-temperature data; the official USDA map uses station-level annual minimums and may differ by half a zone.)`,
    `${name} falls in roughly USDA Zone ${zone}. The zone classification is based on average annual minimum temperatures, so it's the right lookup for whether perennials and trees will overwinter here. Note that this is approximate from our winter-temperature data — check the USDA map for the exact zone before betting an expensive plant on it.`,
    `Zone ${zone}, give or take a half-zone. ${name}'s typical winter low puts it in that band on the USDA Hardiness map, which is what nurseries label plants against. Use Zone ${zone} as your starting filter; the USDA's interactive map is more precise for borderline cases.`,
  ]);
}

function elevationAnswer(slug: string, name: string, elevFt: number | null, elevM: number | null): string | null {
  if (elevFt == null || elevM == null) return null;
  const ft = elevFt.toLocaleString();
  const m = elevM.toLocaleString();
  if (elevFt <= 20) {
    return pick(slug, [
      `${name} sits roughly ${ft} feet (${m} m) above sea level — basically at the waterline. Storm surge, king tides, and long-term sea-level rise are real considerations for any coastal property here.`,
      `Barely above the water. ${name} is at about ${ft} feet (${m} m) elevation, and parts of the city are essentially at sea level. Flood-zone maps are worth checking before buying a house.`,
    ]);
  }
  if (elevFt < 500) {
    return pick(slug, [
      `${name} sits at about ${ft} feet (${m} m) above sea level — low-lying, but with enough cushion that day-to-day life isn't affected by ocean levels.`,
      `Around ${ft} feet (${m} m) above sea level — flat enough that nothing about ${name}'s altitude shows up in daily life.`,
    ]);
  }
  if (elevFt < 1500) {
    return pick(slug, [
      `${name} is at about ${ft} feet (${m} m) above sea level. High enough to be solidly above any coastal concern, low enough that altitude isn't a factor.`,
      `Roughly ${ft} feet (${m} m). That's modest elevation — comparable to most inland-Midwest and Southern cities.`,
    ]);
  }
  if (elevFt < 3500) {
    return pick(slug, [
      `${name} sits at about ${ft} feet (${m} m) — meaningfully higher than coastal cities, but not high enough to noticeably affect breathing or cooking.`,
      `Around ${ft} feet (${m} m) above sea level. Visitors from the coast occasionally notice a slight shift in how dry the air feels; that's about the extent of it.`,
    ]);
  }
  if (elevFt < 5500) {
    return pick(slug, [
      `${name} is at about ${ft} feet (${m} m) — high enough that newcomers from sea level sometimes feel a touch winded the first few days, dehydrate faster than expected, and notice that water boils a little quicker. Acclimation is usually a week or so.`,
      `Roughly ${ft} feet (${m} m) above sea level. At that altitude, the first few days for a coastal visitor can feel mildly off — shorter breath on stairs, faster fatigue — but it normalizes quickly.`,
    ]);
  }
  return pick(slug, [
    `${name} sits at about ${ft} feet (${m} m) above sea level. That's high enough that new arrivals from sea level should expect a real adjustment period: shorter breath, more water than usual, longer cooking times, and meaningful sun protection thanks to the thinner atmosphere.`,
    `Roughly ${ft} feet (${m} m) — high enough to matter physiologically. Plan on a week or two of feeling the altitude before your body recalibrates, drink more water than you think you need, and respect the sun.`,
  ]);
}

function hurricaneAnswer(slug: string, name: string): string {
  return pick(slug, [
    `Officially, Atlantic hurricane season runs June 1 through November 30, but most of the action lands between mid-August and mid-October. For ${name}, that's when to keep half an eye on the National Hurricane Center forecast cone — and when an actual evacuation plan is worth having in the drawer if you're in a low-lying or coastal neighborhood.`,
    `Hurricane season covers June through November, with peak activity in late summer and early fall. For ${name}, the practical advice is: have a few days of water and supplies on hand from August onward, know your evacuation route, and don't wait for the news to tell you a storm is "probably nothing" — track the cone yourself.`,
    `Atlantic basin storms can form from June 1 to November 30, but the serious ones cluster in August, September, and the first half of October. Residents of ${name} learn the season's rhythm fast: watch the cone, board up when it's the call, and don't shrug off the slow-mover storms — those are usually the ones that flood.`,
  ]);
}

function safetyAnswer(slug: string, name: string, crimeRate: number | null): string | null {
  if (crimeRate == null) return null;
  const r = Math.round(crimeRate).toLocaleString();
  if (crimeRate < 2000) {
    return pick(slug, [
      `By the numbers, yes. ${name} reports roughly ${r} crime incidents per 100,000 residents — well under the US average of about 3,500 per 100k. The big caveat applies as always: every city has neighborhoods that look nothing like the citywide average. But the citywide average here is genuinely good.`,
      `The headline number is reassuring. ${name}'s reported incident rate of about ${r} per 100,000 is comfortably below the US norm of around 3,500 per 100k. Specific neighborhoods always vary, but the broader picture is on the safer side.`,
    ]);
  }
  if (crimeRate < 4000) {
    return pick(slug, [
      `Average for an American city. ${name}'s reported crime rate of about ${r} per 100,000 residents sits roughly in line with the US baseline of ~3,500. Like anywhere else, the citywide number masks real differences between neighborhoods — worth looking at specific areas before deciding.`,
      `Middle of the pack. ${name} comes in around ${r} per 100,000, basically the national average. The interesting question is usually which neighborhood, not which city — that's where the real variation lives.`,
    ]);
  }
  if (crimeRate < 6000) {
    return pick(slug, [
      `Higher than average. ${name} reports about ${r} incidents per 100,000 residents, above the US average of around 3,500. Citywide numbers are often dragged up by a few hotspots; specific neighborhoods can be very safe in cities that don't look great on paper, and vice versa.`,
      `Worse than the national norm, but it depends where. ${name}'s ~${r} per 100,000 reflects a citywide aggregate. Some neighborhoods here are notably safer than the average; others are notably worse. Worth looking at the specific area, not the city-level number.`,
    ]);
  }
  return pick(slug, [
    `The citywide numbers are concerning — about ${r} per 100,000 residents, well above the US average of around 3,500. As with all crime stats, the city aggregate hides huge variation between neighborhoods, but the overall picture is worse than most US cities.`,
    `${name}'s reported crime rate runs high: about ${r} per 100,000 residents, materially above the national average. Specific neighborhoods vary widely, but the city-wide aggregate is on the rougher end of the US distribution.`,
  ]);
}

function expensiveAnswer(slug: string, name: string, costIndex: number | null): string | null {
  if (costIndex == null) return null;
  const idx = costIndex.toFixed(0);
  if (costIndex < 90) {
    const pctBelow = (100 - costIndex).toFixed(0);
    return pick(slug, [
      `No — your dollar actually goes further here. ${name}'s composite cost-of-living index is ${idx}, roughly ${pctBelow}% under the US average. Housing is usually the biggest driver of the discount.`,
      `${name} is a genuinely affordable city by US standards. The composite index sits at ${idx} versus the 100 national baseline — about ${pctBelow}% cheaper overall, with housing doing most of the heavy lifting.`,
    ]);
  }
  if (costIndex < 110) {
    return pick(slug, [
      `Roughly average. ${name}'s cost-of-living index is ${idx}, putting it in the band where rent, groceries, and utilities track the national norm. Not a bargain, not a premium.`,
      `It's a middle-of-the-road US city on cost. ${name}'s index of ${idx} sits within a few points of the national average — your money buys roughly what it would in a typical American metro.`,
    ]);
  }
  if (costIndex < 130) {
    const pctAbove = (costIndex - 100).toFixed(0);
    return pick(slug, [
      `Yes, noticeably. ${name}'s cost-of-living index runs ${idx}, about ${pctAbove}% above the US baseline. Housing usually accounts for most of the markup; groceries and services run higher too but with less drama.`,
      `More expensive than average — by enough to plan around. ${name}'s composite index is ${idx} versus 100 for the US, with rent and home prices driving most of the gap. Salaries in higher-paying industries usually move together, but the math still tightens for everyone else.`,
    ]);
  }
  const pctAboveTop = (costIndex - 100).toFixed(0);
  return pick(slug, [
    `Yes — ${name} is one of the more expensive places to live in the US. The cost-of-living index is ${idx}, about ${pctAboveTop}% above the national average. Housing is the dominant factor, and salaries here have to be high to compensate.`,
    `Significantly. ${name}'s index of ${idx} puts it in the top tier of US cities for cost of living — roughly ${pctAboveTop}% above the national baseline. The pattern is familiar: housing eats a large share of incomes, and people earning median-equivalent jobs from cheaper metros feel the difference fast.`,
  ]);
}

function walkableAnswer(slug: string, name: string, walkScore: number | null, transitScore: number | null): string | null {
  if (walkScore == null) return null;
  const transitFragment = transitScore != null ? ` Transit Score is ${transitScore} out of 100.` : "";
  if (walkScore < 25) {
    return pick(slug, [
      `Not really — ${name} is built around the car. Its Walk Score of ${walkScore} out of 100 means almost every errand is a drive.${transitFragment} Living without a car is technically possible but real work; most residents wouldn't try it.`,
      `${name}'s Walk Score is ${walkScore}/100, firmly in the car-required tier.${transitFragment} The layout assumes you'll drive to the grocery store, drive to work, drive everywhere.`,
    ]);
  }
  if (walkScore < 50) {
    return pick(slug, [
      `Mostly car-dependent. ${name}'s Walk Score of ${walkScore}/100 means a handful of errands work on foot — depending on the neighborhood — but most residents still need a car for the rest.${transitFragment}`,
      `${name} scores ${walkScore} out of 100 on Walk Score, which translates to "car-dependent but not aggressively so".${transitFragment} Some neighborhoods buck the citywide average; the dense inner cores are usually noticeably more walkable than the city number suggests.`,
    ]);
  }
  if (walkScore < 70) {
    return pick(slug, [
      `Somewhat. ${name} earns a Walk Score of ${walkScore}/100 — many daily errands are doable on foot, especially in the denser neighborhoods, but a car still helps for longer trips.${transitFragment}`,
      `In parts, yes. With a citywide Walk Score of ${walkScore}/100, ${name} has genuinely walkable neighborhoods alongside more sprawled stretches.${transitFragment} If walkability matters to you, the neighborhood choice will matter more than the city-level number.`,
    ]);
  }
  if (walkScore < 90) {
    return pick(slug, [
      `Yes — ${name} is one of the more walkable US cities. A Walk Score of ${walkScore}/100 means most daily errands can be done on foot in most neighborhoods.${transitFragment} Many residents go car-free comfortably.`,
      `${name} scores ${walkScore}/100 on Walk Score, putting it in the "very walkable" tier.${transitFragment} It's the kind of city where you don't think of going to the grocery store as "going" to the grocery store.`,
    ]);
  }
  return pick(slug, [
    `Genuinely so. ${name}'s Walk Score of ${walkScore} out of 100 puts it in "Walker's Paradise" territory — daily errands don't require a car at all.${transitFragment} Many residents skip car ownership entirely.`,
    `Yes, by US standards it's extraordinary. ${name} scores ${walkScore}/100, one of the highest in the country.${transitFragment} Living here without a car isn't just possible; for many residents it's the default.`,
  ]);
}

function salaryAnswer(slug: string, name: string, costIndex: number | null, medianRent: number | null): string | null {
  if (costIndex == null) return null;
  const recommendedSalary = Math.round(70_000 * (costIndex / 100));
  const rentLine = medianRent != null
    ? ` Median rent in ${name} runs about ${CURRENCY.format(medianRent)}/mo — keeping housing under 30% of gross income points to a similar floor on what you'd want to earn.`
    : "";
  return pick(slug, [
    `Roughly ${CURRENCY.format(recommendedSalary)} a year would match the lifestyle of someone earning ${CURRENCY.format(70_000)} in an average US city. That's a starting point, not a target — negotiate higher when you can.${rentLine}`,
    `As a rule of thumb, plan on about ${CURRENCY.format(recommendedSalary)} to live in ${name} the way a ${CURRENCY.format(70_000)} earner lives in a typical US city. The math gets less forgiving the lower you go below that.${rentLine}`,
  ]);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FAQ({ city }: Props) {
  const q = city.quality;
  const c = city.costs;
  const slug = city.slug;
  const elevFt = getElevationFeet(slug);
  const elevM = getElevationMeters(slug);
  const hurricaneRelevant = isHurricaneRelevant(city.state_code, city.longitude);

  const candidates: { q: string; a: string | null }[] = [
    { q: `Does it snow in ${city.name}?`, a: snowAnswer(slug, city.name, q?.avg_temp_winter ?? null) },
    { q: `How cold does ${city.name} get in winter?`, a: coldAnswer(slug, city.name, q?.avg_temp_winter ?? null) },
    { q: `How hot does ${city.name} get in summer?`, a: hotAnswer(slug, city.name, q?.avg_temp_summer ?? null) },
    { q: `How many sunny days does ${city.name} have?`, a: sunnyAnswer(slug, city.name, q?.sunshine_days ?? null) },
    { q: `What USDA growing zone is ${city.name} in?`, a: growingZoneAnswer(slug, city.name, q?.avg_temp_winter ?? null) },
    { q: `What is the elevation of ${city.name}?`, a: elevationAnswer(slug, city.name, elevFt, elevM) },
    ...(hurricaneRelevant
      ? [{ q: `When is hurricane season in ${city.name}?`, a: hurricaneAnswer(slug, city.name) }]
      : []),
    { q: `Is ${city.name} safe?`, a: safetyAnswer(slug, city.name, q?.crime_rate_per_100k ?? null) },
    { q: `Is ${city.name} expensive to live in?`, a: expensiveAnswer(slug, city.name, c?.cost_index ?? null) },
    { q: `Is ${city.name} walkable?`, a: walkableAnswer(slug, city.name, q?.walk_score ?? null, q?.transit_score ?? null) },
    { q: `What salary do you need to live in ${city.name}?`, a: salaryAnswer(slug, city.name, c?.cost_index ?? null, c?.median_rent ?? null) },
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
