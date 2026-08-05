const { daysBetween } = require("./utils.js");

function getOddsByMid(homeData, awayData, mid) {
  const homeFound = homeData.odds.find((x) => x.matchId === mid && x.found);
  if (homeFound) return homeFound;
  const awayFound = awayData.odds.find((x) => x.matchId === mid && x.found);
  if (awayFound) return awayFound;
  return null;
}

// A team can appear in multiple seasonsForm tables (domestic league, continental group, a
// not-yet-started season, ...). We pick the one the team has played the most matches in, since
// that is the table that best reflects current form/position.
function getSeasonEntryForTeam(teamData, teamUid) {
  let best = null;
  for (const table of teamData.seasonsForm) {
    const entry = table.teams.find((t) => t.team.uid === teamUid);
    if (!entry || !entry.played?.total) continue;
    if (!best || entry.played.total > best.played.total) {
      best = entry;
    }
  }
  return best;
}

// Looks for one seasonsForm table that lists BOTH teams (e.g. same domestic league table, or
// same continental group stage). When found, positions are directly comparable. When not found,
// each team's own best table is used instead, but the comparison is then cross-competition and
// less trustworthy (different leagues have very different levels).
function findSharedTable(teamData, homeUID, awayUID) {
  for (const table of teamData.seasonsForm) {
    const home = table.teams.find((t) => t.team.uid === homeUID);
    const away = table.teams.find((t) => t.team.uid === awayUID);
    if (!home || !away) continue;
    // A table where either side hasn't played a match yet (e.g. season not started) has no
    // real standing to compare - every team sits at position 1, which would be misread as a
    // genuine tie.
    if (!home.played?.total || !away.played?.total) continue;
    return { home, away };
  }
  return null;
}

function getLeagueComparison(homeData, awayData, homeUID, awayUID) {
  const shared =
    findSharedTable(homeData, homeUID, awayUID) ??
    findSharedTable(awayData, homeUID, awayUID);
  if (shared) {
    return { sameCompetition: true, home: shared.home, away: shared.away };
  }

  const home = getSeasonEntryForTeam(homeData, homeUID);
  const away = getSeasonEntryForTeam(awayData, awayUID);
  if (!home || !away) return null;
  return { sameCompetition: false, home, away };
}

// Rest days before `matchDate`, and how many matches were played in the preceding `windowDays`
// (fixture congestion). `matchDate` is a "YYYY-MM-DD" string.
function getRestInfo(teamData, matchDate, windowDays = 10) {
  const previousMatches = teamData.last.filter((m) => m.time?.date < matchDate);
  if (previousMatches.length === 0) {
    return { daysSinceLastMatch: null, matchesInWindow: 0 };
  }
  const daysSinceLastMatch = daysBetween(
    matchDate,
    previousMatches[0].time.date,
  );
  const matchesInWindow = previousMatches.filter(
    (m) => daysBetween(matchDate, m.time.date) <= windowDays,
  ).length;
  return { daysSinceLastMatch, matchesInWindow };
}

// Date and opponent name for a given past matchId, so signal reasons can say *which* match
// their stats/events came from instead of just "last match".
function getLastMatchInfo(teamData, matchId) {
  const match = teamData.last.find((m) => m._id === matchId);
  if (
    !match ||
    match.teams?.home?._id == null ||
    match.teams?.away?._id == null
  )
    return null;
  const isHome = match.teams.home._id === teamData.team._id;
  const opponent = isHome ? match.teams.away.name : match.teams.home.name;
  return { date: match.time.date, opponent };
}

// A lineup's home/away keys are the sides of THAT specific match, not "our team" vs "the
// opponent" - lastLineup in particular can have our team on either side, so it must be matched by
// tid rather than assumed. (nextLineup happens to always have our team on the expected side, since
// it's built for this exact upcoming fixture, but tid-matching is used for both for consistency.)
function ownLineupSide(lineup, teamId) {
  if (!lineup) return null;
  if (lineup.home?.tid === teamId) return lineup.home;
  if (lineup.away?.tid === teamId) return lineup.away;
  return null;
}

// The upcoming lineup's manager is often not published yet (e.g. friendlies), so fall back to the
// last known one - managers rarely change, so it's still an accurate general-info field.
function getManager(teamData) {
  const teamId = teamData.team?._id;
  const manager =
    ownLineupSide(teamData.nextLineup, teamId)?.manager ??
    ownLineupSide(teamData.lastLineup, teamId)?.manager;
  if (!manager) return null;
  return {
    name: manager.name ?? null,
    nationality: manager.nationality ?? null,
  };
}

// Which side ("home"/"away") `teamData`'s team played on in a given past matchId - events are
// tagged by match side, not by which team they belong to, so this is needed to tell "our" events
// apart from the opponent's in that match.
function getMatchSide(teamData, matchId) {
  const match = teamData.last.find((m) => m._id === matchId);
  if (
    !match ||
    match.teams?.home?._id == null ||
    match.teams?.away?._id == null
  )
    return null;
  return match.teams.home._id === teamData.team._id ? "home" : "away";
}

function involvesBothTeams(match, homeUID, awayUID) {
  if (match.teams?.home?._id == null || match.teams?.away?._id == null)
    return false;
  const ids = [match.teams.home._id, match.teams.away._id];
  return ids.includes(homeUID) && ids.includes(awayUID);
}

// The home/away UIDs passed on the CLI are just "which two teams", not necessarily who hosts.
// The fixture may not be each team's very next match either (a friendly/cup game can be
// scheduled in between), so we search each team's `next` list rather than assuming index 0.
function findUpcomingFixture(homeData, awayData, homeUID, awayUID) {
  const match =
    homeData.next.find((m) => involvesBothTeams(m, homeUID, awayUID)) ??
    awayData.next.find((m) => involvesBothTeams(m, homeUID, awayUID));

  if (!match) {
    return { match: null, earlierFixtures: null };
  }

  const earlierFor = (teamData) =>
    teamData.next.filter(
      (m) => m._id !== match._id && m.time.date < match.time.date,
    );

  return {
    match,
    earlierFixtures: {
      home: earlierFor(homeData),
      away: earlierFor(awayData),
    },
  };
}

module.exports = {
  getOddsByMid,
  getSeasonEntryForTeam,
  getLeagueComparison,
  getRestInfo,
  getLastMatchInfo,
  getMatchSide,
  getManager,
  findUpcomingFixture,
};
