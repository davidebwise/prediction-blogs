const { average } = require("./utils.js");

// Each market maps its outcome keys to the `unique_name` used inside odds.bookmakers[].data.markets[].odds
const MARKET_DEFINITIONS = {
  "match-result": { home: "mr-1", draw: "mr-x", away: "mr-2" },
  "both-teams-to-score": { yes: "gnog-yes", no: "gnog-no" },
  "over-under": { over: "over-25", under: "under-25" },
};

// Returns { home, draw, away } / { yes, no } / { over, under } implied probabilities (margin removed),
// averaged across every bookmaker that quotes the market. Returns null if no bookmaker has it.
function getMarketProbabilities(oddsEntry, marketKey) {
  const definition = MARKET_DEFINITIONS[marketKey];
  if (!definition || !oddsEntry || !Array.isArray(oddsEntry.bookmakers)) {
    return null;
  }

  const outcomes = Object.keys(definition);
  const perOutcomeSamples = Object.fromEntries(outcomes.map((o) => [o, []]));

  for (const bookmaker of oddsEntry.bookmakers) {
    const markets = bookmaker?.data?.markets;
    if (!bookmaker.found || !Array.isArray(markets)) continue;

    const market = markets.find((m) => m["unique-market"] === marketKey);
    if (!market || !Array.isArray(market.odds)) continue;

    const rawValues = {};
    let complete = true;
    for (const outcome of outcomes) {
      const odd = market.odds.find((o) => o.unique_name === definition[outcome]);
      if (!odd || !odd.value) {
        complete = false;
        break;
      }
      rawValues[outcome] = odd.value;
    }
    if (!complete) continue;

    // Remove the bookmaker's overround so probabilities sum to 1.
    const impliedProbs = Object.fromEntries(
      outcomes.map((o) => [o, 1 / rawValues[o]]),
    );
    const overround = Object.values(impliedProbs).reduce((a, b) => a + b, 0);
    for (const outcome of outcomes) {
      perOutcomeSamples[outcome].push(impliedProbs[outcome] / overround);
    }
  }

  const result = {};
  for (const outcome of outcomes) {
    result[outcome] = average(perOutcomeSamples[outcome]);
  }
  if (outcomes.some((o) => result[o] == null)) return null;
  return result;
}

module.exports = { getMarketProbabilities };
