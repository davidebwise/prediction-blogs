const { relativeAdvantage } = require("./utils.js");
const { getLastMatchInfo, getMatchSide } = require("./lookup.js");

// Events are tagged with which side of that match ("home"/"away") produced them, not with which
// team they belong to - so events from tracked matches must be filtered down to the side our
// team actually played on, otherwise the opponent's own shots/cards/injuries get counted as ours.
function ownEvents(teamData, matchEntry) {
  const side = getMatchSide(teamData, matchEntry.matchId);
  if (!side) return [];
  return matchEntry.data.value.filter((ev) => ev.team === side);
}

function opponentEvents(teamData, matchEntry) {
  const side = getMatchSide(teamData, matchEntry.matchId);
  if (!side) return [];
  const opponentSide = side === "home" ? "away" : "home";
  return matchEntry.data.value.filter((ev) => ev.team === opponentSide);
}

// Aggregates the shots proxy over the last `n` matches that actually have tracked events (not
// just the single most recent one), since one match alone is a noisy, low-sample proxy.
function shotsProxy(teamData, n = 3) {
  const tracked = teamData.events
    .filter((e) => e.found && e.data?.value)
    .slice(0, n);
  if (tracked.length === 0) return null;
  let onTarget = 0;
  let offTarget = 0;
  let penaltiesWon = 0;
  const scorers = [];
  for (const e of tracked) {
    const own = ownEvents(teamData, e);
    onTarget += own.filter((ev) => ev.type === "shotontarget").length;
    offTarget += own.filter(
      (ev) => ev.type === "shotofftarget" || ev.type === "shotblocked",
    ).length;
    penaltiesWon += own.filter((ev) => ev.type === "penalty_rewarded").length;
    for (const ev of own.filter((ev) => ev.type === "goal")) {
      if (ev.scorer?.name) scorers.push(ev.scorer.name);
    }
  }
  const matches = tracked.length;
  return {
    onTarget: onTarget / matches,
    offTarget: offTarget / matches,
    penaltiesWon: penaltiesWon / matches,
    score: (onTarget * 2 + offTarget + penaltiesWon * 3) / matches,
    scorers,
    matches,
    matchIds: tracked.map((e) => e.matchId),
  };
}

function recentMatchStatsSignal(homeData, awayData) {
  const home = shotsProxy(homeData);
  const away = shotsProxy(awayData);
  if (!home || !away) {
    return {
      value: null,
      reliability: 0,
      reason: "Recent match stats (shots) not available for one or both teams.",
    };
  }
  const value = relativeAdvantage(home.score, away.score);
  const summary = (name, teamData, s) => {
    const opponents = s.matchIds
      .map((id) => getLastMatchInfo(teamData, id))
      .filter(Boolean)
      .map((i) => `${i.opponent} ${i.date}`)
      .join(", ");
    const scorersNote =
      s.scorers.length > 0 ? ` - scorers: ${s.scorers.join(", ")}` : "";
    const penaltiesNote =
      s.penaltiesWon > 0 ? ` - ${s.penaltiesWon.toFixed(2)} penalties won/match` : "";
    return `${name} avg ${s.onTarget.toFixed(1)} on target / ${s.offTarget.toFixed(1)} off-target-blocked per match (last ${s.matches}: ${opponents})${scorersNote}${penaltiesNote}`;
  };
  return {
    value,
    reliability: 1,
    reason: `Recent match shots (proxy): ${summary(homeData.team?.name ?? "Home", homeData, home)}, ${summary(awayData.team?.name ?? "Away", awayData, away)}.`,
  };
}

// A player still marked injured as of the tracked match is a confirmed absence going forward,
// unlike one who already recovered - so it counts for more than a resolved injury.
function injuryWeight(ev) {
  return ev.stillinjured === true || ev.stillinjured === "true" ? 1.5 : 1;
}

// Aggregates red cards/injuries over the last `n` matches with tracked events, rather than just
// the single most recent one, since one match alone is a noisy, low-sample proxy.
function eventsPenalty(teamData, n = 3) {
  const tracked = teamData.events
    .filter((e) => e.found && e.data?.value)
    .slice(0, n);
  if (tracked.length === 0) return null;
  let redCards = 0;
  let injuryScore = 0;
  let penaltiesConceded = 0;
  const redCardPlayers = [];
  const injuredPlayers = [];
  for (const e of tracked) {
    const own = ownEvents(teamData, e);
    const opponent = opponentEvents(teamData, e);
    for (const ev of own.filter(
      (ev) => ev.type === "card" && ev.card === "red",
    )) {
      redCards++;
      if (ev.player?.name) redCardPlayers.push(ev.player.name);
    }
    for (const ev of own.filter((ev) => ev.type === "injury")) {
      injuryScore += injuryWeight(ev);
      if (ev.player?.name) {
        const stillInjured =
          ev.stillinjured === true || ev.stillinjured === "true";
        injuredPlayers.push(
          stillInjured ? `${ev.player.name} (still out)` : ev.player.name,
        );
      }
    }
    penaltiesConceded += opponent.filter((ev) => ev.type === "penalty_rewarded").length;
  }
  const matches = tracked.length;
  return {
    redCards: redCards / matches,
    injuries: injuryScore / matches,
    penaltiesConceded: penaltiesConceded / matches,
    score: (redCards * 2 + injuryScore + penaltiesConceded * 1.5) / matches,
    redCardPlayers,
    injuredPlayers,
    matches,
    matchIds: tracked.map((e) => e.matchId),
  };
}

function lastMatchEventsSignal(homeData, awayData) {
  const home = eventsPenalty(homeData);
  const away = eventsPenalty(awayData);
  if (!home || !away) {
    return {
      value: null,
      reliability: 0,
      reason: "Recent match events not available for one or both teams.",
    };
  }
  // More penalty events = weaker, so invert the sign.
  const value = relativeAdvantage(-home.score, -away.score);
  const summary = (name, teamData, e) => {
    const opponents = e.matchIds
      .map((id) => getLastMatchInfo(teamData, id))
      .filter(Boolean)
      .map((i) => `${i.opponent} ${i.date}`)
      .join(", ");
    const redCardsNote =
      e.redCardPlayers.length > 0
        ? ` - red cards: ${e.redCardPlayers.join(", ")}`
        : "";
    const injuriesNote =
      e.injuredPlayers.length > 0
        ? ` - injuries: ${e.injuredPlayers.join(", ")}`
        : "";
    const penaltiesNote =
      e.penaltiesConceded > 0
        ? ` - ${e.penaltiesConceded.toFixed(2)} penalties conceded/match`
        : "";
    return `${name} avg ${e.redCards.toFixed(2)} red cards/${e.injuries.toFixed(2)} injuries per match (last ${e.matches}: ${opponents})${redCardsNote}${injuriesNote}${penaltiesNote}`;
  };

  return {
    value,
    reliability: 1,
    reason: `Recent match events: ${summary(homeData.team?.name ?? "Home", homeData, home)}, ${summary(awayData.team?.name ?? "Away", awayData, away)}.`,
  };
}

// Per-player breakdown (by player _id, not just name) over the last `n` tracked matches - not a
// weighted signal itself, but exposed so other signals (e.g. lineup matching) can later cross-
// reference "is this in-form scorer / injured player actually in the announced squad".
function getPlayerEvents(teamData, n = 3) {
  const tracked = teamData.events.filter((e) => e.found && e.data?.value).slice(0, n);
  const scorersById = new Map();
  const injuredById = new Map();
  const redCardedById = new Map();
  for (const e of tracked) {
    const own = ownEvents(teamData, e);
    for (const ev of own.filter((ev) => ev.type === "goal")) {
      if (!ev.scorer?._id) continue;
      const entry = scorersById.get(ev.scorer._id) ?? { id: ev.scorer._id, name: ev.scorer.name, goals: 0 };
      entry.goals++;
      scorersById.set(ev.scorer._id, entry);
    }
    for (const ev of own.filter((ev) => ev.type === "injury")) {
      if (!ev.player?._id || injuredById.has(ev.player._id)) continue;
      // `tracked` is most-recent-first, so the first occurrence for a player is their latest
      // known status - later (older) matches must not overwrite it.
      const stillInjured = ev.stillinjured === true || ev.stillinjured === "true";
      injuredById.set(ev.player._id, { id: ev.player._id, name: ev.player.name, stillInjured });
    }
    for (const ev of own.filter((ev) => ev.type === "card" && ev.card === "red")) {
      if (!ev.player?._id) continue;
      redCardedById.set(ev.player._id, { id: ev.player._id, name: ev.player.name });
    }
  }
  return {
    scorers: [...scorersById.values()],
    injured: [...injuredById.values()],
    redCarded: [...redCardedById.values()],
  };
}

module.exports = {
  shotsProxy,
  recentMatchStatsSignal,
  eventsPenalty,
  lastMatchEventsSignal,
  getPlayerEvents,
};
