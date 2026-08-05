const { relativeAdvantage, clamp } = require("./utils.js");
const { getPlayerEvents } = require("./events.js");

function squadPlayerIds(lineup) {
  const players = lineup?.players;
  if (!Array.isArray(players) || players.length === 0) return null;
  const ids = players.map((p) => p.player?.id).filter((id) => id != null);
  return new Set(ids);
}

// Cross-references this team's recent-form players (from events.js) against the confirmed
// squad for the upcoming fixture: in-form scorers who made the squad boost confidence, ones left
// out weaken it, and a player still marked injured who is nonetheless in the squad is a red flag
// worth surfacing (either a recovery not yet reflected elsewhere, or a data mismatch).
function lineupImpact(teamData, squadIds) {
  const { scorers, injured } = getPlayerEvents(teamData);
  const present = scorers.filter((s) => squadIds.has(s.id));
  const missing = scorers.filter((s) => !squadIds.has(s.id));
  const stillInjuredInSquad = injured.filter((p) => p.stillInjured && squadIds.has(p.id));
  return {
    presentScorers: present,
    missingScorers: missing,
    stillInjuredInSquad,
    presentGoals: present.reduce((sum, s) => sum + s.goals, 0),
    missingGoals: missing.reduce((sum, s) => sum + s.goals, 0),
  };
}

function lineupSignal(homeData, awayData) {
  const homeSquad = squadPlayerIds(homeData.nextLineup?.home);
  const awaySquad = squadPlayerIds(awayData.nextLineup?.away);
  if (!homeSquad || !awaySquad) {
    return { value: null, reliability: 0, reason: "Lineups not published yet." };
  }

  const home = lineupImpact(homeData, homeSquad);
  const away = lineupImpact(awayData, awaySquad);

  // Shifted into a positive range (like restFreshnessSignal's freshness score) since
  // relativeAdvantage assumes non-negative magnitudes on both sides.
  const impactScore = (t) =>
    clamp(t.presentGoals - t.missingGoals - t.stillInjuredInSquad.length, -5, 5) + 6;
  const value = relativeAdvantage(impactScore(home), impactScore(away));

  const summary = (name, t) => {
    const missingNote =
      t.missingScorers.length > 0
        ? ` - missing: ${t.missingScorers.map((s) => `${s.name} (${s.goals}g)`).join(", ")}`
        : "";
    const injuredNote =
      t.stillInjuredInSquad.length > 0
        ? ` - still injured but in squad: ${t.stillInjuredInSquad.map((p) => p.name).join(", ")}`
        : "";
    return `${name} in-form scorers in squad: ${t.presentScorers.map((s) => `${s.name} (${s.goals}g)`).join(", ") || "none"}${missingNote}${injuredNote}`;
  };

  return {
    value,
    reliability: 1,
    reason: `${summary(homeData.team?.name ?? "Home", home)}. ${summary(awayData.team?.name ?? "Away", away)}.`,
  };
}

module.exports = {
  lineupSignal,
};
