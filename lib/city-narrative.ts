/**
 * Generate human-readable narrative copy for a city profile page from
 * its structured data. Used to add 300+ words of unique indexable
 * content to each /should-i-move-to/[slug] page.
 *
 * Pure text composition. No I/O. Output is deterministic per city —
 * the slug hash picks one of several phrasings per data band so the
 * 600 pages don't all read like a mail merge of each other.
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

/** Stable hash of a string. Tiny, just enough to spread cities across
 *  the variant index for each block. */
function hashSlug(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h * 31) + seed.charCodeAt(i)) >>> 0;
  return h;
}
function pick<T>(seed: string, variants: T[], offset = 0): T {
  return variants[(hashSlug(seed) + offset) % variants.length];
}

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

function safetyVerdict(slug: string, safetyDimension: number | null | undefined): string {
  if (safetyDimension == null) return "";
  if (safetyDimension >= 85)
    return pick(slug, [
      "On crime, it scores well — incidents per capita run noticeably under the national average.",
      "Crime numbers are reassuringly low here, well under the typical US city.",
    ]);
  if (safetyDimension >= 65)
    return pick(slug, [
      "Crime sits a notch better than the national norm — not crime-free, but a step above average.",
      "On the safer side of the national distribution, though not by a huge margin.",
    ]);
  if (safetyDimension >= 45)
    return pick(slug, [
      "Crime rates land roughly average for a US city of this size.",
      "On safety, this is a middle-of-the-pack city — neither standout nor concerning.",
    ]);
  if (safetyDimension >= 25)
    return pick(slug, [
      "Crime runs a touch higher than the typical US city — citywide numbers, of course, mask big neighborhood differences.",
      "Reported crime is somewhat above average, though specific neighborhoods vary widely.",
    ]);
  return pick(slug, [
    "Crime statistics are on the rougher end of the US distribution; the citywide aggregate hides safer pockets but the headline number isn't great.",
    "Crime runs notably high by national standards. As always, neighborhood-level data tells a more nuanced story than the citywide figure.",
  ]);
}

function walkabilityVerdict(slug: string, walk: number | null): string {
  if (walk == null) return "";
  if (walk >= 90)
    return pick(slug, [
      "Walkability is exceptional — most residents can live without a car if they want to.",
      "A walker's paradise by US standards. Many people here genuinely skip car ownership.",
    ]);
  if (walk >= 70)
    return pick(slug, [
      "Very walkable in most central neighborhoods — daily errands rarely require a car.",
      "Walking covers most daily life if you live in a central neighborhood; a car is helpful for longer trips but not essential.",
    ]);
  if (walk >= 50)
    return pick(slug, [
      "Some neighborhoods are walkable; others aren't. A car is useful, but not required everywhere.",
      "Walkability varies a lot by neighborhood — denser pockets work fine on foot, the rest leans on driving.",
    ]);
  if (walk >= 25)
    return pick(slug, [
      "Car-dependent for most errands, with small walkable pockets downtown or in older neighborhoods.",
      "You'll need a car for most things, though the central core is more walkable than the citywide score suggests.",
    ]);
  return pick(slug, [
    "Built around the car — walking isn't really an option for daily life.",
    "Almost entirely car-dependent. Sidewalks exist; they just don't connect to where you need to go.",
  ]);
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

export function generateNarrative(
  city: CityProfile,
  scores: Partial<Record<Profile, UrbRankScore>>,
): Narrative {
  const slug = city.slug;
  const costs = city.costs;
  const demos = city.demographics;
  const qual = city.quality;
  const general = scores.general;
  const dims = general?.dimension_scores ?? {};

  const aff = affordabilityLabel(costs?.cost_index ?? null);
  const climate = climateLabel(
    qual?.avg_temp_summer ?? null,
    qual?.avg_temp_winter ?? null,
  );

  // ------------------------------------------------------------------
  // Intro — opening paragraph, 2-3 sentences, varied per city
  // ------------------------------------------------------------------
  const incomeTxt = costs?.median_household_income
    ? CURRENCY.format(costs.median_household_income)
    : null;
  const rentTxt = costs?.median_rent ? CURRENCY.format(costs.median_rent) : null;
  const popN = city.population ? PCT.format(city.population) : null;
  const metroFragment = city.metro_area ? ` in the ${city.metro_area} metro area` : "";

  // Open with one of several phrasings, then add the cost line, then a
  // numbers fragment (when we have it), then the UrbRank score note.
  const opener = popN
    ? pick(slug, [
        `${city.name}, ${city.state} is home to about ${popN} people${metroFragment}.`,
        `Roughly ${popN} people live in ${city.name}, ${city.state}${metroFragment}.`,
        `${city.name}, ${city.state} comes in at about ${popN} residents${metroFragment}.`,
      ])
    : pick(slug, [
        `${city.name}, ${city.state}${metroFragment} is one of the cities we cover.`,
        `Here's what the data shows for ${city.name}, ${city.state}${metroFragment}.`,
      ]);

  const costLine = pick(slug, [
    ` On cost of living, it lands in the ${aff.band} band — ${aff.vsNational}.`,
    ` Living here costs ${aff.band} relative to the rest of the country, ${aff.vsNational}.`,
    ` Cost of living comes out ${aff.band} — ${aff.vsNational}.`,
  ]);

  let numbersFragment = "";
  if (rentTxt && incomeTxt) {
    numbersFragment = pick(slug, [
      ` The median renter pays around ${rentTxt} a month against a typical household income of ${incomeTxt}.`,
      ` Median rent runs about ${rentTxt}/mo; the typical household pulls in ${incomeTxt}.`,
      ` Rent typically lands near ${rentTxt}/mo, and the median household income is about ${incomeTxt}.`,
    ]);
  } else if (rentTxt) {
    numbersFragment = ` Median rent here is about ${rentTxt}/mo.`;
  } else if (incomeTxt) {
    numbersFragment = ` Median household income runs about ${incomeTxt}.`;
  }

  let scoreFragment = "";
  if (general) {
    const rankBit = general.national_rank
      ? `, putting it at #${general.national_rank} nationally`
      : "";
    scoreFragment = pick(slug, [
      ` Our composite UrbRank Score lands at ${general.score.toFixed(0)} out of 100 (grade ${general.grade})${rankBit}.`,
      ` On the UrbRank Score it pulls a ${general.score.toFixed(0)}/100 — a ${general.grade}${rankBit}.`,
      ` Overall, ${general.score.toFixed(0)}/100 on our composite score, which works out to a ${general.grade}${rankBit}.`,
    ]);
  }

  const intro = `${opener}${costLine}${numbersFragment}${scoreFragment}`;

  // ------------------------------------------------------------------
  // Cost snapshot — 2-4 sentences, conversational
  // ------------------------------------------------------------------
  let costSnapshot = "";
  if (costs?.cost_index != null) {
    costSnapshot += pick(slug, [
      `${city.name}'s composite cost-of-living index lands at ${costs.cost_index.toFixed(0)} (100 = US average), which puts it in the ${aff.band} band. `,
      `By the composite index, ${city.name} sits at ${costs.cost_index.toFixed(0)} — ${aff.band} when stacked against the rest of the country. `,
      `Cost-of-living index of ${costs.cost_index.toFixed(0)} (with 100 as the US baseline) — that's ${aff.band} territory. `,
    ]);
  }
  if (costs?.median_rent && costs?.median_household_income) {
    const rentToIncome = (Number(costs.median_rent) * 12) / Number(costs.median_household_income);
    if (Number.isFinite(rentToIncome) && rentToIncome > 0) {
      const pctNum = PCT.format(rentToIncome * 100);
      const ratioLead = pick(slug, [
        `At ${rentTxt}/mo against ${incomeTxt} in median household income, the typical renter spends about ${pctNum}% of income on housing`,
        `Running the rent-to-income math (${rentTxt}/mo against ${incomeTxt} median household income), housing eats roughly ${pctNum}% of a typical paycheck`,
        `With median rent at ${rentTxt}/mo and median household income at ${incomeTxt}, housing takes about ${pctNum}% of gross income`,
      ]);
      const band =
        rentToIncome < 0.2
          ? " — comfortably under the 30% rule of thumb, which is unusual."
          : rentToIncome < 0.3
            ? " — right inside the standard 30%-of-income guideline."
            : rentToIncome < 0.4
              ? " — a bit above the 30% rule, meaning housing is on the tight side for the median household."
              : " — well above 30%, which is the band where most financial advisors start flagging housing stress.";
      costSnapshot += ratioLead + band + " ";
    }
  }
  if (costs?.median_home_value) {
    costSnapshot += pick(slug, [
      `Median home value sits around ${CURRENCY.format(Number(costs.median_home_value))}.`,
      `Buying-side, the median home value is ${CURRENCY.format(Number(costs.median_home_value))}.`,
      `Homes typically value around ${CURRENCY.format(Number(costs.median_home_value))}.`,
    ]);
  }
  if (!costSnapshot) {
    costSnapshot = `We're still filling in detailed cost data for ${city.name}.`;
  }

  // ------------------------------------------------------------------
  // Climate + lifestyle — combine climate, walkability, safety, AQI
  // ------------------------------------------------------------------
  const summer = qual?.avg_temp_summer;
  const winter = qual?.avg_temp_winter;
  const precip = qual?.annual_precipitation;

  let climateOpener = "";
  if (summer && winter) {
    climateOpener = pick(slug, [
      `Climate is ${climate} — summer averages around ${summer.toFixed(0)}°F, winter averages around ${winter.toFixed(0)}°F.`,
      `The weather here is ${climate}: roughly ${summer.toFixed(0)}°F in summer, ${winter.toFixed(0)}°F in winter.`,
      `Expect ${climate} weather — summers near ${summer.toFixed(0)}°F, winters around ${winter.toFixed(0)}°F.`,
    ]);
  } else {
    climateOpener = `${city.name} has a ${climate} climate.`;
  }
  if (precip) {
    climateOpener += pick(slug, [
      ` Precipitation totals about ${precip.toFixed(0)} inches a year.`,
      ` Annual precipitation lands near ${precip.toFixed(0)} inches.`,
      ` Rain (and snow, in some seasons) totals about ${precip.toFixed(0)} inches annually.`,
    ]);
  }

  const walkTxt = walkabilityVerdict(slug, qual?.walk_score ?? null);
  const safetyTxt = safetyVerdict(slug, dims.safety);
  let aqiTxt = "";
  if (qual?.air_quality_index != null) {
    const aqi = qual.air_quality_index;
    if (aqi < 50)
      aqiTxt = pick(slug, [
        ` Air quality reads good (AQI ${aqi.toFixed(0)}).`,
        ` AQI runs about ${aqi.toFixed(0)} — a "good" reading.`,
      ]);
    else if (aqi < 100)
      aqiTxt = pick(slug, [
        ` Air quality is moderate (AQI ${aqi.toFixed(0)}).`,
        ` AQI is in the moderate range at about ${aqi.toFixed(0)}.`,
      ]);
    else if (aqi < 150)
      aqiTxt = ` Air quality lands in the "unhealthy for sensitive groups" range (AQI ${aqi.toFixed(0)}) — usually fine, but worth watching if you have asthma or are sensitive.`;
    else
      aqiTxt = ` Air quality reads poor (AQI ${aqi.toFixed(0)}) — a real consideration for anyone with respiratory issues.`;
  }

  const climateText = [climateOpener, walkTxt, safetyTxt, aqiTxt]
    .filter(Boolean)
    .join(" ");

  // ------------------------------------------------------------------
  // Per-profile verdicts
  // ------------------------------------------------------------------
  const verdictByProfile: Narrative["verdictByProfile"] = [];
  const profiles: Profile[] = ["family", "retiree", "remote_worker", "young_professional"];
  for (const p of profiles) {
    const score = scores[p];
    if (!score) continue;
    const grade = score.grade;
    const lead =
      score.score >= 75
        ? pick(slug, [
            `${city.name} reads as a strong fit for ${PROFILE_LABELS[p].toLowerCase()}.`,
            `For ${PROFILE_LABELS[p].toLowerCase()}, ${city.name} is one of the stronger US options.`,
            `If you're profiling for ${PROFILE_LABELS[p].toLowerCase()}, ${city.name} comes out well.`,
          ])
        : score.score < 55
          ? pick(slug, [
              `${city.name} doesn't obviously fit ${PROFILE_LABELS[p].toLowerCase()}.`,
              `For ${PROFILE_LABELS[p].toLowerCase()}, ${city.name} isn't the strongest match.`,
              `${city.name} is a tougher sell for ${PROFILE_LABELS[p].toLowerCase()}.`,
            ])
          : pick(slug, [
              `${city.name} reads as a moderate fit for ${PROFILE_LABELS[p].toLowerCase()}.`,
              `For ${PROFILE_LABELS[p].toLowerCase()}, ${city.name} is workable — not standout, not weak.`,
              `On the ${PROFILE_LABELS[p].toLowerCase()} profile, ${city.name} sits squarely in the middle.`,
            ]);
    const profileDims = score.dimension_scores;
    const sortedProfile = (Object.entries(profileDims) as [DimensionKey, number][])
      .filter(([, v]) => v != null)
      .sort((a, b) => b[1] - a[1]);
    const top = sortedProfile[0];
    const bottom = sortedProfile[sortedProfile.length - 1];
    const detail =
      top && bottom && top[0] !== bottom[0]
        ? pick(slug, [
            ` Strongest on ${DIM_LABELS[top[0]]} (${top[1]}/100); weakest on ${DIM_LABELS[bottom[0]]} (${bottom[1]}/100).`,
            ` Its standout dimension is ${DIM_LABELS[top[0]]} (${top[1]}/100); the soft spot is ${DIM_LABELS[bottom[0]]} (${bottom[1]}/100).`,
          ])
        : "";
    const scoreSentence = pick(slug, [
      ` It earns ${score.score.toFixed(0)}/100 (grade ${grade}) on the ${PROFILE_LABELS[p].toLowerCase()} profile.${detail}`,
      ` The profile-weighted score is ${score.score.toFixed(0)}/100 — a ${grade}.${detail}`,
    ]);
    verdictByProfile.push({ profile: p, verdict: `${lead}${scoreSentence}` });
  }

  // ------------------------------------------------------------------
  // FAQs — 4-6 city-specific questions, all hand-written variants
  // ------------------------------------------------------------------
  const faqs: Narrative["faqs"] = [];
  if (general) {
    faqs.push({
      q: `What is ${city.name}'s UrbRank Score?`,
      a: pick(slug, [
        `${city.name}, ${city.state} pulls a ${general.score.toFixed(0)}/100 overall on the UrbRank Score (grade ${general.grade})${general.national_rank ? `, currently ranked #${general.national_rank} nationally` : ""}. The composite weights seven lifestyle dimensions: affordability, safety, climate, walkability, jobs, environment, and education.`,
        `Our overall score for ${city.name} is ${general.score.toFixed(0)}/100 — a ${general.grade}${general.national_rank ? `, sitting at #${general.national_rank} in the national ranking` : ""}. It's a weighted average across the seven UrbRank dimensions.`,
      ]),
    });
  }
  if (costs?.cost_index != null) {
    faqs.push({
      q: `Is ${city.name} expensive to live in?`,
      a: pick(slug, [
        `${city.name}'s cost-of-living index is ${costs.cost_index.toFixed(0)} (with 100 as the US average), which lands in the ${aff.band} band — ${aff.vsNational}.${rentTxt ? ` Median rent runs about ${rentTxt}/mo.` : ""}`,
        `By the composite index, ${city.name} sits at ${costs.cost_index.toFixed(0)} — ${aff.band}, ${aff.vsNational}.${rentTxt ? ` Median renter pays around ${rentTxt} a month.` : ""}`,
      ]),
    });
  }
  if (qual?.avg_temp_summer && qual?.avg_temp_winter) {
    faqs.push({
      q: `What's the climate like in ${city.name}?`,
      a: pick(slug, [
        `${climate.charAt(0).toUpperCase() + climate.slice(1)} — summer averages around ${qual.avg_temp_summer.toFixed(0)}°F, winter averages around ${qual.avg_temp_winter.toFixed(0)}°F${precip ? `, with about ${precip.toFixed(0)} inches of precipitation a year` : ""}.`,
        `${city.name} runs ${climate} on the weather. Summer's near ${qual.avg_temp_summer.toFixed(0)}°F, winter's near ${qual.avg_temp_winter.toFixed(0)}°F${precip ? `; ${precip.toFixed(0)} inches of precipitation annually` : ""}.`,
      ]),
    });
  }
  if (qual?.walk_score != null) {
    faqs.push({
      q: `Is ${city.name} walkable?`,
      a: `Walk Score: ${qual.walk_score}/100. ${walkabilityVerdict(slug, qual.walk_score)}`,
    });
  }
  if (demos?.college_educated_pct != null) {
    const pct = PCT.format(Number(demos.college_educated_pct));
    const ageBit = demos.median_age ? ` with a median age of ${Number(demos.median_age).toFixed(0)}` : "";
    faqs.push({
      q: `What's the population like in ${city.name}?`,
      a: pick(slug, [
        `${city.name} has${city.population ? ` about ${PCT.format(city.population)} residents` : " a sizable community"}, ${pct}% of adults 25+ holding a bachelor's degree or higher${ageBit}.`,
        `Roughly${city.population ? ` ${PCT.format(city.population)} people` : " a substantial population"} live here, with ${pct}% college-educated (bachelor's or higher) among adults 25+${ageBit}.`,
      ]),
    });
  }
  faqs.push({
    q: `How does ${city.name} compare to other cities?`,
    a: pick(slug, [
      `Use UrbRank's comparison tool to put ${city.name} head-to-head against any other US city — housing, salaries, demographics, and quality-of-life metrics side by side. The leaderboard pages also show how ${city.name} stacks up for families, retirees, remote workers, and young professionals specifically.`,
      `Drop ${city.name} into the comparison tool with any other US city and you'll get housing costs, salaries, demographics, and quality-of-life data lined up side by side. Profile-specific leaderboards (families, retirees, remote workers, young professionals) are linked from the navigation.`,
    ]),
  });

  return { intro, costSnapshot, climateAndLifestyle: climateText, verdictByProfile, faqs };
}
