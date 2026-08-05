const fs = require("node:fs");
const { predictMatch } = require("./predict.js");
const { decompress, cleanTeamData } = require("./clean.js");
const { getPreMatchContext } = require("./news.js");

const homeUID = Number(process.argv[2] ?? "2692"); // Milan
const awayUID = Number(process.argv[3] ?? "2697"); // Inter

// const homeUID = Number(process.argv[2] ?? "2032"); // Milan
// const awayUID = Number(process.argv[3] ?? "2042"); // Inter

const getDataFronN8N = (id) =>
  `http://10.0.0.32:5678/webhook/420c62d1-9c85-4e29-a050-0168a1d934ef?team=${id}`;

// FUNCTION INIT

async function Init() {
  let homeData = await fetch(getDataFronN8N(homeUID)).then((r) => r.json());
  let awayData = await fetch(getDataFronN8N(awayUID)).then((r) => r.json());

  /* TEST PURPOSE */
  // fs.writeFileSync("home.json", JSON.stringify(homeData));
  // fs.writeFileSync("away.json", JSON.stringify(awayData));
  // let homeData = JSON.parse(fs.readFileSync("home.json", "utf-8"));
  // let awayData = JSON.parse(fs.readFileSync("away.json", "utf-8"));
  /* END TEST PURPOSE */

  homeData = decompress(homeData.data);
  awayData = decompress(awayData.data);

  // console.log(Object.keys(homeData));
  // [ 'next', 'last', 'nextLineup', 'lastLineup', 'seasonsForm', 'tids', 'team', 'events', 'odds' ]

  // console.log(Object.keys(homeData.next[0]));
  // ['_id','_rcid','_seasonid','comment','disqualified','inlivescore','is_virtual','neutralground','numberofperiods','periods','postponed','result','retired','round','stadiumid','status','teams','time','tobeannounced','walkover','week','updatedAt','stadium','season']

  // console.log(Object.keys(homeData.lastLineup));
  // ['_id','away','confirmed','created_at','home','seasonid','status','updated_at']

  // console.log(Object.keys(homeData.seasonsForm[0]));
  // ['_id','created_at','currentround','losspoints','matchtype','tabletype','teams','updated_at','winpoints']

  // console.log(Object.keys(homeData.events[0]));
  // [ 'matchId', 'hashKey', 'fieldKey', 'found', 'data' ]

  // console.log(Object.keys(homeData.odds[0]));
  // [ 'matchId', 'hashKey', 'found', 'bookmakerCount', 'bookmakers' ]

  homeData = cleanTeamData(homeData);
  awayData = cleanTeamData(awayData);

  const prediction = predictMatch(homeData, awayData, { homeUID, awayUID });

  /* OUTPUT */
  // console.log(JSON.stringify(prediction, null, 2));

  fs.writeFileSync("prediction.json", JSON.stringify(prediction));

  /* NEWS */

  /*   const news = await getPreMatchContext({
    home: prediction.match.home.name,
    away: prediction.match.away.name,
    date: prediction.match.date,
  });

  fs.writeFileSync("news.json", JSON.stringify(news));

  console.log(news); */
}

Init();
