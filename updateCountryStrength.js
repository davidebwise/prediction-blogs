// Regenerates the FIFA_RANKING and UEFA_COEFFICIENTS tables inside countryStrength.js from
// data/fifaRanking.json and data/uefaCoefficients.json.
//
// How to refresh the rankings:
// 1. Update data/fifaRanking.json with the latest FIFA Men's World Ranking (inside.fifa.com),
//    as a flat { "Country Name": rank } map.
// 2. Update data/uefaCoefficients.json with the latest UEFA country coefficient
//    (kassiesa.net / footballseeding.com), as a flat { "Country Name": coefficient } map.
// 3. Run: node updateCountryStrength.js
//
// This only rewrites the two marked blocks (and the snapshot date) - the rest of
// countryStrength.js (fallback constants, lookup functions) is left untouched.
const fs = require("node:fs");
const path = require("node:path");

const COUNTRY_STRENGTH_FILE = path.join(__dirname, "countryStrength.js");

function formatTable(varName, data) {
  const entries = Object.entries(data)
    .map(([country, value]) => {
      const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(country) ? country : JSON.stringify(country);
      return `  ${key}: ${value},`;
    })
    .join("\n");
  return `const ${varName} = {\n${entries}\n};`;
}

function replaceBlock(source, name, replacement) {
  const startMarker = `// === ${name}:START`;
  const endMarker = `// === ${name}:END ===`;
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`Could not find markers for ${name} in countryStrength.js`);
  }
  const blockStart = source.indexOf("\n", startIdx) + 1;
  return source.slice(0, blockStart) + replacement + "\n" + source.slice(endIdx);
}

function main() {
  const fifaRanking = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data", "fifaRanking.json"), "utf-8"),
  );
  const uefaCoefficients = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data", "uefaCoefficients.json"), "utf-8"),
  );

  let source = fs.readFileSync(COUNTRY_STRENGTH_FILE, "utf-8");
  source = replaceBlock(source, "FIFA_RANKING", formatTable("FIFA_RANKING", fifaRanking));
  source = replaceBlock(
    source,
    "UEFA_COEFFICIENTS",
    formatTable("UEFA_COEFFICIENTS", uefaCoefficients),
  );

  const today = new Date().toISOString().slice(0, 10);
  source = source.replace(/const SNAPSHOT_DATE = "[^"]*";/, `const SNAPSHOT_DATE = "${today}";`);
  source = source.replace(/Snapshot date: [\d-]+\./, `Snapshot date: ${today}.`);

  fs.writeFileSync(COUNTRY_STRENGTH_FILE, source);
  console.log(
    `countryStrength.js updated: ${Object.keys(fifaRanking).length} FIFA entries, ${Object.keys(uefaCoefficients).length} UEFA entries, snapshot date ${today}.`,
  );
}

main();
