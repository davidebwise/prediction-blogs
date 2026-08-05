const { getOddsByMid, findUpcomingFixture, getManager } = require("./lookup.js");
const { predict1X2, predictOverUnder25, predictBtts, WEIGHTS } = require("./markets.js");

// Included in every response so the JSON is self-explanatory to a reader (human or LLM) who has
// no access to this codebase.
const LEGEND = {
  value:
    "Signal/score scale: -1 to +1. Negative favors the away team / 'no' / 'under', positive favors the home team / 'yes' / 'over', 0 = perfectly balanced.",
  reliability:
    "0 to 1 multiplier applied to a signal's `value` before it's combined into the market score. 1 = fully trusted, lower = trusted less (e.g. comparing league positions across different competitions), 0 = value is null and the signal is excluded entirely (data missing).",
  score:
    "Weighted average of all of a market's signal values (each weighted by its listed weight x its reliability), on the same -1..+1 scale.",
  probabilities: "Final outcome probabilities for the market, derived from `score`.",
  weights:
    "Points out of 100 assigned to each signal for that market (see top-level `weights`), before the reliability discount described above is applied.",
};

// Finds the fixture between homeUID/awayUID (searching both teams' `next` lists, since it may
// not be index 0 for either), then predicts all markets. Returns { match: null, notes } if the
// two teams have no such fixture scheduled.
function predictMatch(homeData, awayData, { homeUID, awayUID }) {
  const { match, earlierFixtures } = findUpcomingFixture(homeData, awayData, homeUID, awayUID);

  if (!match) {
    return {
      match: null,
      legend: LEGEND,
      notes: [
        `No fixture found between ${homeUID} and ${awayUID} in either team's upcoming matches.`,
      ],
    };
  }

  const notes = [];
  if (earlierFixtures.home.length > 0) {
    notes.push(
      `The home team (${homeUID}) plays ${earlierFixtures.home.length} match(es) before this one: ${earlierFixtures.home.map((m) => m.time.date).join(", ")}.`,
    );
  }
  if (earlierFixtures.away.length > 0) {
    notes.push(
      `The away team (${awayUID}) plays ${earlierFixtures.away.length} match(es) before this one: ${earlierFixtures.away.map((m) => m.time.date).join(", ")}.`,
    );
  }

  const ctx = {
    matchId: match._id,
    matchDate: match.time.date,
    homeUID,
    awayUID,
    odds: getOddsByMid(homeData, awayData, match._id),
  };

  const prediction1X2 = predict1X2(homeData, awayData, ctx);

  // Flag when the league position signal had to compare two different competitions (different
  // domestic leagues, or national teams vs clubs), since that comparison is only an approximation
  // (country-strength adjusted) rather than a like-for-like table position.
  const leaguePosition = prediction1X2.signals.leaguePosition;
  if (leaguePosition.value != null && leaguePosition.reliability < 1) {
    const homeKind = homeData.team?.iscountry ? "national team" : "club";
    const awayKind = awayData.team?.iscountry ? "national team" : "club";
    notes.push(
      `${homeData.team?.name ?? "Home"} (${homeKind}) and ${awayData.team?.name ?? "Away"} (${awayKind}) aren't in the same competition, so the league position signal is an approximation (see 1x2.signals.leaguePosition.reason) with reduced reliability (${leaguePosition.reliability}).`,
    );
  }

  return {
    match: {
      id: match._id,
      date: match.time.date,
      home: { name: homeData.team?.name ?? null, manager: getManager(homeData) },
      away: { name: awayData.team?.name ?? null, manager: getManager(awayData) },
      competition: match.season?.name ?? null,
      friendly: match.season?.friendly ?? null,
    },
    legend: LEGEND,
    weights: WEIGHTS,
    notes,
    "1x2": prediction1X2,
    overUnder25: predictOverUnder25(homeData, awayData, ctx),
    btts: predictBtts(homeData, awayData, ctx),
  };
}

module.exports = { predictMatch };
