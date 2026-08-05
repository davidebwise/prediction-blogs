const pako = require("pako");
const { deleteKeys } = require("./lib.js");

function decompress(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError("Il valore deve essere una stringa Base64 valida");
  }

  const compressed = Buffer.from(value, "base64");
  const inflated = pako.inflate(compressed);
  const jsonString = new TextDecoder("utf-8").decode(inflated);

  return JSON.parse(jsonString);
}

function cleanMatch(x) {
  return deleteKeys(x, [
    ...["home", "away"]
      .map((y) => [
        `teams.${y}._doc`,
        `teams.${y}.awayjersey`,
        `teams.${y}.awayjersey2`,
        `teams.${y}.homejersey`,
        `teams.${y}.gkjersey`,
        `teams.${y}.website`,
        `teams.${y}.updated_at`,
        `teams.${y}.created_at`,
        `teams.${y}.teamtypeid`,
        `teams.${y}.suffix`,
        `teams.${y}.founded`,
        `teams.${y}.haslogo`,
        `teams.${y}.sex`,
        `teams.${y}.nickname`,
      ])
      .flat(),
    `time._doc`,
    `time.tz`,
    `season._utid`,
    `season.created_at`,
    `season.updated_at`,
    `season.data_quality`,
    `stadium.updated_at`,
  ]);
}

function cleanLineup(x) {
  return deleteKeys(x, [
    ...["home", "away"].map((y) => [`${y}.jersey`]).flat(),
    "updated_at",
    "created_at",
    "confirmed",
    "seasonid",
    "status",
  ]);
}

function cleanSeasonsForm(x) {
  return deleteKeys(x, ["created_at", "updated_at", "losspoints", "winpoints"]);
}

function cleanEvents(x) {
  return deleteKeys(x, ["hashKey", "fieldKey", "data.updated_at", "data.updated_at_human"]);
}

function cleanOdds(x) {
  return deleteKeys(x, ["hashKey"]);
}

function cleanTeamData(teamData) {
  teamData.last = teamData.last.map(cleanMatch);
  teamData.next = teamData.next.map(cleanMatch);
  teamData.lastLineup = cleanLineup(teamData.lastLineup);
  teamData.nextLineup = cleanLineup(teamData.nextLineup);
  teamData.seasonsForm = teamData.seasonsForm.map(cleanSeasonsForm);
  teamData.events = teamData.events.map(cleanEvents);
  teamData.odds = teamData.odds.map(cleanOdds);
  return teamData;
}

module.exports = {
  decompress,
  cleanMatch,
  cleanLineup,
  cleanSeasonsForm,
  cleanEvents,
  cleanOdds,
  cleanTeamData,
};
