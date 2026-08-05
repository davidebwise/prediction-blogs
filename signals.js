const { relativeAdvantage, average, clamp } = require("./utils.js");
const { getLeagueComparison, getRestInfo, getLastMatchInfo } = require("./lookup.js");
const { getMarketProbabilities } = require("./oddsService.js");
const { getCountryRating, getCountryStrengthFactor } = require("./countryStrength.js");
const { lineupSignal } = require("./lineup.js");
const {
  shotsProxy,
  recentMatchStatsSignal,
  eventsPenalty,
  lastMatchEventsSignal,
} = require("./events.js");

// Every weighted signal returns { value, reliability, reason }:
// - value: [-1, 1] home-advantage score, or null if it can't be computed (excluded from weighting).
// - reliability: 0-1, how much to trust `value` (defaults to 1); scales its effective weight.
// - reason: human-readable explanation of what produced the value, for the prediction output.

function leaguePositionSignal(homeData, awayData, ctx) {
  const comparison = getLeagueComparison(homeData, awayData, ctx.homeUID, ctx.awayUID);
  if (!comparison) {
    return {
      value: null,
      reliability: 0,
      reason: "No standings available for one or both teams (e.g. preseason).",
    };
  }

  const { home, away, sameCompetition } = comparison;
  // The home team's position when playing at home, and the away team's position when playing
  // away, are more relevant to this specific fixture than their overall table position - but
  // only if that split has actually been played; otherwise it's not a real standing.
  const homePos = (home.played?.home ? home.position.home : null) || home.position.total;
  const awayPos = (away.played?.away ? away.position.away : null) || away.position.total;
  const homeName = homeData.team?.name ?? "Home";
  const awayName = awayData.team?.name ?? "Away";

  if (sameCompetition) {
    const value = relativeAdvantage(1 / homePos, 1 / awayPos);
    return {
      value,
      reliability: 1,
      reason: `${homeName} #${homePos} at home vs ${awayName} #${awayPos} away, same table.`,
    };
  }

  // Different competitions: raw positions aren't comparable (1st in a weaker competition isn't
  // "better" than 5th in a stronger one), so we scale each side's position by its country's
  // strength as a proxy. National teams (iscountry: true) use the FIFA World Ranking (it
  // measures national-team strength directly); clubs use the UEFA country coefficient instead,
  // since the FIFA ranking would be misleading for clubs (e.g. Argentina/Croatia rank highly on
  // national-team talent that mostly plays abroad, which says nothing about their own domestic
  // league's club-for-club strength). Still an approximation, so reliability stays capped.
  const homeIsNational = homeData.team?.iscountry === true;
  const awayIsNational = awayData.team?.iscountry === true;
  const homeCountry = homeData.team?.countrycode?.name;
  const awayCountry = awayData.team?.countrycode?.name;
  const homeStrength = (1 / homePos) * getCountryStrengthFactor(homeCountry, homeIsNational);
  const awayStrength = (1 / awayPos) * getCountryStrengthFactor(awayCountry, awayIsNational);
  const value = relativeAdvantage(homeStrength, awayStrength);

  const homeRating = getCountryRating(homeCountry, homeIsNational);
  const awayRating = getCountryRating(awayCountry, awayIsNational);
  const knownBoth = homeRating != null && awayRating != null;
  const reliability = knownBoth ? 0.6 : 0.15;

  const ratingLabel = (name, isNational, rating) => {
    const source = isNational ? "FIFA" : "UEFA coeff.";
    return rating != null ? `${name} (${source} ${isNational ? "#" : ""}${rating})` : `${name} (${source} unknown)`;
  };
  const reason = knownBoth
    ? `${homeName} #${homePos} at home vs ${awayName} #${awayPos} away, in different competitions - adjusted by country strength: ${ratingLabel(homeName, homeIsNational, homeRating)} vs ${ratingLabel(awayName, awayIsNational, awayRating)}.`
    : `${homeName} #${homePos} at home and ${awayName} #${awayPos} away, in different competitions, and at least one country's rating is unknown, so the adjustment is rough and reliability is kept low.`;

  return { value, reliability, reason };
}

function oddsSignal(homeData, awayData, ctx) {
  const probs = getMarketProbabilities(ctx.odds, "match-result");
  if (!probs) {
    return { value: null, reliability: 0, reason: "1X2 market not quoted by any bookmaker." };
  }
  const value = relativeAdvantage(probs.home, probs.away);
  const pct = (p) => `${Math.round(p * 100)}%`;
  return {
    value,
    reliability: 1,
    reason: `Implied odds (margin removed): 1 ${pct(probs.home)}, X ${pct(probs.draw)}, 2 ${pct(probs.away)}.`,
  };
}

// Some fixtures (walkovers, unresolved placeholders) have a null teams.home/away - skip them.
function playedMatches(teamData, n) {
  return teamData.last.filter((m) => m.teams?.home?._id != null && m.teams?.away?._id != null).slice(0, n);
}

function formPoints(teamData) {
  const matches = playedMatches(teamData, 5);
  if (matches.length === 0) return null;
  let wins = 0,
    draws = 0,
    losses = 0;
  for (const m of matches) {
    if (m.result.winner == null) {
      draws++;
      continue;
    }
    const isHome = m.teams.home._id === teamData.team._id;
    const won = (isHome && m.result.winner === "home") || (!isHome && m.result.winner === "away");
    if (won) wins++;
    else losses++;
  }
  return { wins, draws, losses, played: matches.length, points: wins * 3 + draws };
}

function formLast5Signal(homeData, awayData) {
  const home = formPoints(homeData);
  const away = formPoints(awayData);
  if (!home || !away) {
    return { value: null, reliability: 0, reason: "No prior matches available." };
  }
  const value = relativeAdvantage(home.points, away.points);
  const summary = (name, f) => `${name} ${f.points}pt (${f.wins}W-${f.draws}D-${f.losses}L in ${f.played})`;
  return {
    value,
    reliability: 1,
    reason: `Last 5 form: ${summary(homeData.team?.name ?? "Home", home)}, ${summary(awayData.team?.name ?? "Away", away)}.`,
  };
}

// Raw helper (not a weighted signal by itself) used by markets.js to build market-specific
// goal signals (1X2 attack balance, Over/Under expected goals, BTTS).
function goalsRecentSignal(teamData, n = 5) {
  const matches = playedMatches(teamData, n);
  if (matches.length === 0) return { scored: null, conceded: null };
  const isHome = (m) => m.teams.home._id === teamData.team?._id;
  const scored = average(matches.map((m) => (isHome(m) ? m.result.home : m.result.away)));
  const conceded = average(matches.map((m) => (isHome(m) ? m.result.away : m.result.home)));
  return { scored, conceded };
}

function restFreshnessSignal(homeData, awayData, ctx) {
  const home = getRestInfo(homeData, ctx.matchDate);
  const away = getRestInfo(awayData, ctx.matchDate);
  if (home.daysSinceLastMatch == null || away.daysSinceLastMatch == null) {
    return {
      value: null,
      reliability: 0,
      reason: "No prior match found to compute rest days.",
    };
  }
  const freshness = (rest) => rest.daysSinceLastMatch - rest.matchesInWindow * 1.5;
  const value = relativeAdvantage(
    clamp(freshness(home), 0, 30) + 1,
    clamp(freshness(away), 0, 30) + 1,
  );

  // Beyond ~20 days, a longer gap is no longer "extra rest before this match" - it's an
  // off-season/international break, which doesn't reliably translate into a freshness edge
  // (it can just as easily mean rust). Discount the signal when either side is in that regime.
  const staleGapThreshold = 20;
  const reliability =
    home.daysSinceLastMatch > staleGapThreshold || away.daysSinceLastMatch > staleGapThreshold
      ? 0.4
      : 1;

  const summary = (name, r) =>
    `${name} ${r.daysSinceLastMatch.toFixed(1)} days of rest (${r.matchesInWindow} matches in the last 10 days)`;
  const staleNote =
    reliability < 1
      ? " One side's gap looks like an off-season break rather than short-term rest, so this signal is discounted."
      : "";
  return {
    value,
    reliability,
    reason: `Rest/fixture congestion: ${summary(homeData.team?.name ?? "Home", home)}, ${summary(awayData.team?.name ?? "Away", away)}.${staleNote}`,
  };
}

module.exports = {
  leaguePositionSignal,
  oddsSignal,
  formLast5Signal,
  recentMatchStatsSignal,
  goalsRecentSignal,
  lineupSignal,
  lastMatchEventsSignal,
  restFreshnessSignal,
};
