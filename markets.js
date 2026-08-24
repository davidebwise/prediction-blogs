const { getMarketProbabilities } = require("./oddsService.js");
const { relativeAdvantage } = require("./utils.js");
const signals = require("./signals.js");

// Weight sets are expressed as points out of 100, one weight set per market.
// 1X2 keeps the user's original 7 signals, with an 8th "rest/freshness" signal folded in.
const WEIGHTS = {
  "1x2": {
    leaguePosition: 20,
    odds: 20,
    formLast5: 20,
    recentMatchStats: 10,
    goalsRecent: 10,
    lineup: 10,
    lastMatchEvents: 5,
    restFreshness: 5,
  },
  overUnder25: {
    odds: 25,
    goalsRecent: 30,
    recentMatchStats: 20,
    lineup: 15,
    restFreshness: 10,
  },
  btts: {
    odds: 25,
    goalsRecent: 30,
    recentMatchStats: 20,
    lineup: 15,
    restFreshness: 10,
  },
};

// Converts a [-1, 1] home-advantage score into home/draw/away probabilities.
// The draw share shrinks as the match becomes more one-sided.
function scoreTo1X2(score) {
  const drawBase = 0.27;
  const draw = clampProb(drawBase - Math.abs(score) * 0.12);
  const remaining = 1 - draw;
  const home = remaining * (0.5 + score / 2);
  const away = remaining - home;
  return { home: clampProb(home), draw, away: clampProb(away) };
}

function clampProb(p) {
  return Math.min(0.97, Math.max(0.03, p));
}

function clampSignal(v) {
  return Math.min(1, Math.max(-1, v));
}

// Combines { value, reliability } signals: a signal's effective weight is `weight * reliability`,
// so unreliable signals (e.g. cross-league position) sway the score less, and missing signals
// (value === null) are excluded entirely rather than counted as neutral.
function weightedAverageScore(weights, signalMap) {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const signal = signalMap[key];
    if (!signal || signal.value == null) continue;
    const effectiveWeight = weight * (signal.reliability ?? 1);
    weightedSum += signal.value * effectiveWeight;
    totalWeight += effectiveWeight;
  }
  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}

function predict1X2(homeData, awayData, ctx) {
  const signalMap = {
    leaguePosition: signals.leaguePositionSignal(homeData, awayData, ctx),
    odds: signals.oddsSignal(homeData, awayData, ctx),
    formLast5: signals.formLast5Signal(homeData, awayData),
    recentMatchStats: signals.recentMatchStatsSignal(homeData, awayData),
    goalsRecent: goalsRecentAdvantage(homeData, awayData),
    lineup: signals.lineupSignal(homeData, awayData),
    lastMatchEvents: signals.lastMatchEventsSignal(homeData, awayData),
    restFreshness: signals.restFreshnessSignal(homeData, awayData, ctx),
  };
  const score = weightedAverageScore(WEIGHTS["1x2"], signalMap);
  return { probabilities: scoreTo1X2(score), score, signals: signalMap };
}

// { value, reliability, reason } for "which side has the better expected attacking output",
// derived from goals scored/conceded over the last 5 matches.
function goalsRecentAdvantage(homeData, awayData) {
  const home = signals.goalsRecentSignal(homeData);
  const away = signals.goalsRecentSignal(awayData);
  if (home.scored == null || away.scored == null) {
    return {
      value: null,
      reliability: 0,
      reason: "Recent goals not available.",
    };
  }
  const homeAttack = Math.max(home.scored - away.conceded * 0.3, 0.1);
  const awayAttack = Math.max(away.scored - home.conceded * 0.3, 0.1);
  return {
    value: relativeAdvantage(homeAttack, awayAttack),
    reliability: 1,
    reason: `Last 5 goal average: ${homeData.team?.name ?? "Home"} ${home.scored.toFixed(2)} scored/${home.conceded.toFixed(2)} conceded, ${awayData.team?.name ?? "Away"} ${away.scored.toFixed(2)} scored/${away.conceded.toFixed(2)} conceded.`,
  };
}

function expectedTotalGoals(homeData, awayData) {
  const home = signals.goalsRecentSignal(homeData);
  const away = signals.goalsRecentSignal(awayData);
  if (home.scored == null || away.scored == null) return null;
  return (home.scored + home.conceded + away.scored + away.conceded) / 2;
}

function predictOverUnder25(homeData, awayData, ctx) {
  const marketProbs = getMarketProbabilities(ctx.odds, "over-under");
  const oddsSignal = marketProbs
    ? {
        value: marketProbs.over - marketProbs.under,
        reliability: 1,
        reason: `Over/Under 2.5 odds (margin removed): Over ${Math.round(marketProbs.over * 100)}%, Under ${Math.round(marketProbs.under * 100)}%.`,
      }
    : {
        value: null,
        reliability: 0,
        reason: "Over/Under 2.5 market not quoted.",
      };

  const expectedGoals = expectedTotalGoals(homeData, awayData);
  const goalsSignal =
    expectedGoals == null
      ? { value: null, reliability: 0, reason: "Recent goals not available." }
      : {
          // expectedGoals of 2.5 is neutral; +/-1.5 goals moves the signal to +/-1.
          value: clampSignal((expectedGoals - 2.5) / 1.5),
          reliability: 1,
          reason: `Expected total goals (last 5 of both teams): ${expectedGoals.toFixed(2)} (threshold 2.5).`,
        };

  const signalMap = {
    odds: oddsSignal,
    goalsRecent: goalsSignal,
    recentMatchStats: signals.recentMatchStatsSignal(homeData, awayData),
    lineup: signals.lineupSignal(homeData, awayData),
    restFreshness: signals.restFreshnessSignal(homeData, awayData, ctx),
  };
  const score = weightedAverageScore(WEIGHTS.overUnder25, signalMap);
  const over = clampProb(0.5 + score / 2);
  return {
    probabilities: { over, under: 1 - over },
    score,
    signals: signalMap,
  };
}

function predictBtts(homeData, awayData, ctx) {
  const marketProbs = getMarketProbabilities(ctx.odds, "both-teams-to-score");
  const oddsSignal = marketProbs
    ? {
        value: marketProbs.yes - marketProbs.no,
        reliability: 1,
        reason: `BTTS odds (margin removed): Yes ${Math.round(marketProbs.yes * 100)}%, No ${Math.round(marketProbs.no * 100)}%.`,
      }
    : { value: null, reliability: 0, reason: "BTTS market not quoted." };

  const home = signals.goalsRecentSignal(homeData);
  const away = signals.goalsRecentSignal(awayData);
  const goalsSignal =
    home.scored == null || away.scored == null
      ? { value: null, reliability: 0, reason: "Recent goals not available." }
      : {
          value: clampSignal((Math.min(home.scored, away.scored) - 1) / 1.2),
          reliability: 1,
          reason: `Last 5 goals-scored average (the lower one weighs more): ${homeData.team?.name ?? "Home"} ${home.scored.toFixed(2)}, ${awayData.team?.name ?? "Away"} ${away.scored.toFixed(2)}.`,
        };

  const signalMap = {
    odds: oddsSignal,
    goalsRecent: goalsSignal,
    recentMatchStats: signals.recentMatchStatsSignal(homeData, awayData),
    lineup: signals.lineupSignal(homeData, awayData),
    restFreshness: signals.restFreshnessSignal(homeData, awayData, ctx),
  };
  const score = weightedAverageScore(WEIGHTS.btts, signalMap);
  const yes = clampProb(0.5 + score / 2);
  return { probabilities: { yes, no: 1 - yes }, score, signals: signalMap };
}

module.exports = { WEIGHTS, predict1X2, predictOverUnder25, predictBtts };
