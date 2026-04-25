/**
 * Generate human-readable narrative copy for a city profile page from
 * its structured data. Used to add ~300+ words of unique indexable
 * content to each /should-i-move-to/[slug] page.
 *
 * Pure text composition. No I/O. Output is deterministic per city.
 */
import type { CityProfile } from "./cities";
import type { DimensionKey, Profile, UrbRankScore } from "./urbrank-score";
import { PROFILE_LABELS } from "./urbrank-score";

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const PCT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Classify a temperature pair into a climate descriptor. */
function climateLabel(summer: number | null, winter: number | null): string {
  if (summer == null || winter == null) return "varied";
  if (winter > 50) return "warm year-round";
  if (winter > 38 && summer < 88) return "mild";
  if (winter > 25 && summer < 92) return "four-season";
  if (winter <= 25 && summer < 85) return "cold-winter";
  if (summer >= 92) return "hot-summer";
  return "varied";
}

function affordabilityLabel(costIndex: number | null): {
  band: "very affordable" | "affordable" | "moderate" | "expensive" | "very expensive";
  vsNational: string;
} {
  if (costIndex == null) {
    return { band: "moderate", vsNational: "near the national average" };
  }
  const dev = costIndex - 100;
  const pct = PCT.format(Math.abs(dev));
  const direction = dev > 0 ? "above" : "below";
  const vsNational =
    Math.abs(dev) < 3
      ? "essentially matching the national average"
      : `${pct}% ${direction} the national average`;
  if (costIndex < 85) return { band: "very affordable", vsNational };
  if (costIndex < 95) return { band: "affordable", vsNational };
  if (costIndex < 110) return { band: "moderate", vsNational };
  if (costIndex < 130) return { band: "expensive", vsNational };
  return { band: "very expensive", vsNational };
}

function safetyVerdict(safetyDimension: number | null | undefined): string {
  if (safetyDimension == null) return "Crime data isn't available for this city.";
  if (safetyDimension >= 85) return "Crime rates are well below the national average.";
  if (safetyDimension >= 65) return "Crime rates are comparable to or slightly better than national norms.";
  if (safetyDimension >= 45) return "Crime rates are roughly average for a US city of this size.";
  if (safetyDimension >= 25) return "Crime rates run somewhat higher than the typical US city.";
  return "Crime rates are notably elevated versus most US cities.";
}

function walkabilityVerdict(walk: number | null): string {
  if (walk == null) return "";
  if (walk >= 90) return "An exceptionally walkable city — daily errands rarely require a car.";
  if (walk >= 70) return "Very walkable — most errands can be done on foot from a central neighborhood.";
  if (walk >= 50) return "Somewhat walkable — many neighborhoods support daily errands without a car.";
  if (walk >= 25) return "Car-dependent for most errands, with pockets of walkability downtown.";
  return "Almost entirely car-dependent.";
}

const DIM_LABELS: Record<DimensionKey, string> = {
  affordability: "affordability",
  safety: "safety",
  climate: "climate",
  walkability: "walkability",
  job_market: "job market",
  environment: "environmental quality",
  education: "education",
};

export type Narrative = {
  intro: string;
  costSnapshot: string;
  climateAndLifestyle: string;
  verdictByProfile: { profile: Profile; verdict: string }[];
  faqs: { q: string; a: string }[];
};

/**
 * Compose 4 narrative blocks for the city page. Each block draws from a
 * different facet of the data so we don't end up restating the same
 * facts repeatedly across the page.
 */
export function generateNarrative(
  city: CityProfile,
  scores: Partial<Record<Profile, UrbRankScore>>,
): Narrative {
  const costs = city.costs;
  const demos = city.demographics;
  const qual = city.quality;
  const general = scores.general;
  const dims = general?.dimension_scores ?? {};

  const aff = affordabilityLabel(costs?.cost_index ?? null);
  const climate = climateLabel(qual?.avg_temp_summer ?? null, qual?.avg_temp_winter ?? null);

  // ------------------------------------------------------------------
  // Intro block — 2-3 sentences with the key headline numbers
  // ------------------------------------------------------------------
  const incomeTxt = costs?.median_household_income
    ? CURRENCY.format(costs.median_household_income)
    : null;
  const rentTxt = costs?.median_rent ? CURRENCY.format(costs.median_rent) : null;
  const popTxt = city.population
    ? `population of ${PCT.format(city.population)}`
    : "growing community";

  let intro = `${city.name}, ${city.state} is a ${popTxt} `;
  if (city.metro_area) intro += `in the ${city.metro_area} metro area`;
  intro += `. Cost of living is ${aff.band} — ${aff.vsNational}`;
  if (rentTxt && incomeTxt) {
    intro += `, with median rent around ${rentTxt}/month and median household income of ${incomeTxt}`;
  }
  intro += ".";
  if (general) {
    intro += ` Overall it earns an UrbRank Score of ${general.score.toFixed(0)}/100 (grade ${general.grade})`;
    if (general.national_rank) {
      intro += `, ranking #${general.national_rank} nationally`;
    }
    intro += ".";
  }

  // ------------------------------------------------------------------
  // Cost snapshot — 3-4 sentences on cost specifics
  // ------------------------------------------------------------------
  let costSnapshot = "";
  if (costs?.cost_index != null) {
    costSnapshot += `${city.name}'s composite cost-of-living index sits at ${costs.cost_index.toFixed(0)} (US average = 100), placing it in the ${aff.band} tier. `;
  }
  if (costs?.median_rent && incomeTxt) {
    const rentToIncome = (Number(costs.median_rent) * 12) / Number(costs.median_household_income ?? 1);
    if (Number.isFinite(rentToIncome) && rentToIncome > 0) {
      const pct = PCT.format(rentToIncome * 100);
      costSnapshot += `At ${rentTxt}/month median rent against ${incomeTxt} median household income, residents spend about ${pct}% of household income on rent`;
      const band =
        rentToIncome < 0.2 ? " — well within the 30% rule of thumb." :
        rentToIncome < 0.3 ? " — within the standard 30% rule of thumb." :
        rentToIncome < 0.4 ? " — slightly above the 30% rule, indicating tight affordability." :
        " — well above the 30% rule, suggesting housing pressure for the typical earner.";
      costSnapshot += band;
    }
  }
  if (costs?.median_home_value) {
    costSnapshot += ` Median home value is ${CURRENCY.format(Number(costs.median_home_value))}.`;
  }
  if (!costSnapshot) {
    costSnapshot = `Detailed cost data for ${city.name} is being collected.`;
  }

  // ------------------------------------------------------------------
  // Climate and lifestyle — covers climate, walkability, environment
  // ------------------------------------------------------------------
  const summer = qual?.avg_temp_summer;
  const winter = qual?.avg_temp_winter;
  const precip = qual?.annual_precipitation;
  let climateText = `${city.name} has a ${climate} climate`;
  if (summer && winter) {
    climateText += ` — summer highs average ${summer.toFixed(0)}°F and winter lows average ${winter.toFixed(0)}°F`;
  }
  if (precip) climateText += `, with ${precip.toFixed(0)} inches of precipitation annually`;
  climateText += ".";
  const walkTxt = walkabilityVerdict(qual?.walk_score ?? null);
  if (walkTxt) climateText += ` ${walkTxt}`;
  const safetyTxt = safetyVerdict(dims.safety);
  climateText += ` ${safetyTxt}`;
  if (qual?.air_quality_index != null) {
    const aqi = qual.air_quality_index;
    const aqiLabel =
      aqi < 50 ? "good" :
      aqi < 100 ? "moderate" :
      aqi < 150 ? "unhealthy for sensitive groups" :
      "poor";
    climateText += ` Air quality is ${aqiLabel} (AQI ${aqi.toFixed(0)}).`;
  }

  // ------------------------------------------------------------------
  // Per-profile verdicts — short paragraph for each available profile
  // ------------------------------------------------------------------
  const verdictByProfile: Narrative["verdictByProfile"] = [];
  const profiles: Profile[] = ["family", "retiree", "remote_worker", "young_professional"];
  for (const p of profiles) {
    const score = scores[p];
    if (!score) continue;
    const grade = score.grade;
    const isStrong = score.score >= 75;
    const isWeak = score.score < 55;
    const lead = isStrong
      ? `${city.name} is a strong fit for ${PROFILE_LABELS[p].toLowerCase()}.`
      : isWeak
        ? `${city.name} is a less obvious fit for ${PROFILE_LABELS[p].toLowerCase()}.`
        : `${city.name} is a moderate fit for ${PROFILE_LABELS[p].toLowerCase()}.`;
    // Highlight one strength and one weakness within this profile
    const profileDims = score.dimension_scores;
    const sortedProfile = (Object.entries(profileDims) as [DimensionKey, number][])
      .filter(([, v]) => v != null)
      .sort((a, b) => b[1] - a[1]);
    const top = sortedProfile[0];
    const bottom = sortedProfile[sortedProfile.length - 1];
    const detail = top && bottom && top[0] !== bottom[0]
      ? ` Especially strong on ${DIM_LABELS[top[0]]} (${top[1]}/100), weakest on ${DIM_LABELS[bottom[0]]} (${bottom[1]}/100).`
      : "";
    verdictByProfile.push({
      profile: p,
      verdict: `${lead} It earns a Score of ${score.score.toFixed(0)}/100 (grade ${grade}) on the ${PROFILE_LABELS[p].toLowerCase()} profile.${detail}`,
    });
  }

  // ------------------------------------------------------------------
  // FAQ entries — 4-6 specific questions per city
  // ------------------------------------------------------------------
  const faqs: Narrative["faqs"] = [];
  if (general) {
    faqs.push({
      q: `What is ${city.name}'s UrbRank Score?`,
      a: `${city.name}, ${city.state} has an overall UrbRank Score of ${general.score.toFixed(0)}/100 (grade ${general.grade})${general.national_rank ? `, ranked #${general.national_rank} nationally` : ""}. The score is a weighted average across affordability, safety, climate, walkability, jobs, environment, and education.`,
    });
  }
  if (costs?.cost_index != null) {
    faqs.push({
      q: `Is ${city.name} expensive to live in?`,
      a: `${city.name}'s cost-of-living index is ${costs.cost_index.toFixed(0)} (US average = 100), so it's ${aff.band} — ${aff.vsNational}.${rentTxt ? ` Median rent is ${rentTxt}/month.` : ""}`,
    });
  }
  if (qual?.avg_temp_summer && qual?.avg_temp_winter) {
    faqs.push({
      q: `What's the climate like in ${city.name}?`,
      a: `${city.name} has a ${climate} climate. Summer highs average ${qual.avg_temp_summer.toFixed(0)}°F and winter lows average ${qual.avg_temp_winter.toFixed(0)}°F${precip ? `, with ${precip.toFixed(0)} inches of annual precipitation` : ""}.`,
    });
  }
  if (qual?.walk_score != null) {
    faqs.push({
      q: `Is ${city.name} walkable?`,
      a: `${city.name} has a Walk Score of ${qual.walk_score}/100. ${walkabilityVerdict(qual.walk_score)}`,
    });
  }
  if (demos?.college_educated_pct != null) {
    faqs.push({
      q: `What's the population like in ${city.name}?`,
      a: `${city.name} has${city.population ? ` a population of ${PCT.format(city.population)}` : " a sizable community"}, with ${PCT.format(Number(demos.college_educated_pct))}% of adults 25+ holding a bachelor's degree or higher${demos.median_age ? ` and a median age of ${Number(demos.median_age).toFixed(0)}` : ""}.`,
    });
  }
  // Always include an actionable FAQ pointing to the comparison tool
  faqs.push({
    q: `How does ${city.name} compare to other cities?`,
    a: `Use UrbRank's comparison tool to put ${city.name} side-by-side with any other US city — housing costs, salaries, demographics, and quality of life metrics displayed together. The leaderboard pages also show how ${city.name} ranks for families, retirees, remote workers, and young professionals.`,
  });

  return { intro, costSnapshot, climateAndLifestyle: climateText, verdictByProfile, faqs };
}
