const fs = require("node:fs");
const { predictMatch } = require("./predict.js");
const { decompress, cleanTeamData } = require("./clean.js");

const getDataFronN8N = (id) =>
  `http://10.0.0.32:5678/webhook/420c62d1-9c85-4e29-a050-0168a1d934ef?team=${id}`;

async function Init(homeUID, awayUID) {
  let homeData = await fetch(getDataFronN8N(homeUID)).then((r) => r.json());
  let awayData = await fetch(getDataFronN8N(awayUID)).then((r) => r.json());

  homeData = decompress(homeData.data);
  awayData = decompress(awayData.data);

  homeData = cleanTeamData(homeData);
  awayData = cleanTeamData(awayData);

  const prediction = predictMatch(homeData, awayData, { homeUID, awayUID });

  return { prediction };
}

module.exports = { Init };
