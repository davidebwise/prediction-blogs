// webhook matches
// http://10.0.0.32:5678/webhook/3c2a2651-5dd4-40ca-b5cd-5968b90a1233
//

const { Init } = require("./matchService.js");
const { getPreMatchContext } = require("./news.js");
const fs = require("node:fs");
const { Agent } = require("undici");
const { toChileDate, CHILE_TIME_ZONE } = require("./utils.js");
const { validatePredictionArticle } = require("./predictionArticle.js");

const MATCHES_FILE = "data/matches.json";
const PREDICTIONS_DIR = "data/predictions";
const BLOG_DIR = "data/blogs";
const NEWS_DIR = "data/news";
const LIMIT = 5;
const CLEAN_BEFORE = false;
const ENABLE_NEWS = true;

const FAVORITE_SEASONS = [
  140786, // Champions League
  142776, // Europa League
  142778, // Conference League
  142176, // La Liga
  140756, // Premier League
  137800, // Chile
];

const OLLAMA_HOST = "http://vps-921c83db.vps.ovh.net:11434";
//const OLLAMA_MODEL = "qwen3.5-27b-q5";
//const OLLAMA_MODEL = "openrouter/free";

//const OLLAMA_HOST = "http://localhost:11434";
const OLLAMA_MODEL = "openai-codex/gpt-5.6-luna";

const OLLAMA_TIMEOUT_MS = 30 * 60 * 1000; // 30 minuti, LLM locale può essere lento

const ollamaAgent = new Agent({
  headersTimeout: OLLAMA_TIMEOUT_MS,
  bodyTimeout: OLLAMA_TIMEOUT_MS,
  connect: { timeout: OLLAMA_TIMEOUT_MS },
});

const BLOG_SYSTEM_PROMPT = fs.readFileSync(
  "blog-article-es-prompt.md",
  "utf-8",
);

async function generateBlogArticle(prediction) {
  const messages = [
    { role: "system", content: BLOG_SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(prediction) },
  ];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        think: "low",
        stream: false,
        messages,
      }),
      dispatcher: ollamaAgent,
    }).then((r) => r.json());

    const article = res.message?.content ?? "";
    const errors = validatePredictionArticle(article);
    if (errors.length === 0) return article;

    if (attempt === 2) {
      throw new Error(
        `Articolo non valido dopo ${attempt} tentativi: ${errors.join(" ")}`,
      );
    }

    messages.push(
      { role: "assistant", content: article },
      {
        role: "user",
        content:
          "Corrige la respuesta anterior y devuelve el artículo completo. " +
          `Incumplimientos detectados: ${errors.join(" ")}`,
      },
    );
  }
}

const NEWS_SUMMARY_SYSTEM_PROMPT = fs.readFileSync(
  "news-summary-es-prompt.md",
  "utf-8",
);
const NO_NEWS_TOKEN = "NO_NEWS";

async function generateNewsSummary(news) {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      think: "low",
      stream: false,
      messages: [
        { role: "system", content: NEWS_SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(news) },
      ],
    }),
    dispatcher: ollamaAgent,
  }).then((r) => r.json());

  return res.message.content;
}

const PUBLISH_DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  timeZone: CHILE_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

function buildPublishDateLine(date = new Date()) {
  return `*Publicado el ${PUBLISH_DATE_FORMATTER.format(date)}*`;
}

async function processMatch(match) {
  const uidHome = match.team_home.uid;
  const uidAway = match.team_away.uid;
  console.time(`match ${match.home}-${match.away}||${match.mId}`);
  const prediction = await Init(uidHome, uidAway);
  console.timeEnd(`match ${match.home}-${match.away}||${match.mId}`);
  fs.writeFileSync(
    `${PREDICTIONS_DIR}/${match.mId}.json`,
    JSON.stringify(prediction, null, 2),
  );

  let newsSummary = null;
  if (ENABLE_NEWS && FAVORITE_SEASONS.includes(match.seasonid)) {
    console.log(
      `Stagione preferita (${match.seasonid}): recupero news per ${match.home}-${match.away}||${match.mId}`,
    );
    console.time(`news ${match.home}-${match.away}||${match.mId}`);
    const news = await getPreMatchContext({
      home: prediction.prediction.match.home.name,
      away: prediction.prediction.match.away.name,
      date:
        toChileDate(match.datetimeiso) ?? prediction.prediction.match.date,
      competition: prediction.prediction.match.competition,
    });
    if (news?.events?.length > 0) {
      const summary = await generateNewsSummary(news);
      if (summary?.trim() !== NO_NEWS_TOKEN) {
        newsSummary = summary;
      }
    }
    fs.writeFileSync(
      `${NEWS_DIR}/${match.mId}.json`,
      JSON.stringify({ news, newsSummary }, null, 2),
    );
    console.timeEnd(`news ${match.home}-${match.away}||${match.mId}`);
    if (newsSummary) {
      console.log(
        `News inserite per ${match.home}-${match.away}||${match.mId} (stagione ${match.seasonid})`,
      );
    } else {
      console.log(
        `Nessuna news rilevante per ${match.home}-${match.away}||${match.mId} (stagione ${match.seasonid})`,
      );
    }
  }

  console.time(`blog ${match.home}-${match.away}||${match.mId}`);
  const article = await generateBlogArticle(prediction);
  console.timeEnd(`blog ${match.home}-${match.away}||${match.mId}`);
  const blogBody = newsSummary ? `${newsSummary}\n\n${article}` : article;
  const blogContent = `${blogBody.trimEnd()}\n\n${buildPublishDateLine()}\n`;
  fs.writeFileSync(`${BLOG_DIR}/${match.mId}.md`, blogContent);
}

const CDN_ENDPOINT = "https://cdnbfc.com/";
const CDN_BLOG_PATH = "predictionsBlogs";

async function uploadFileToCdn(filePath, fileName) {
  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append("file", new Blob([buffer]), fileName);

  const url = `${CDN_ENDPOINT}?path=${encodeURIComponent(CDN_BLOG_PATH)}`;
  const res = await fetch(url, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(
      `Upload fallito per ${fileName}: ${res.status} ${await res.text()}`,
    );
  }

  return res.json();
}

async function uploadBlogsToCdn() {
  const files = fs.readdirSync(BLOG_DIR);
  for (const fileName of files) {
    const filePath = `${BLOG_DIR}/${fileName}`;
    console.time(`upload ${fileName}`);
    const result = await uploadFileToCdn(filePath, fileName);
    console.timeEnd(`upload ${fileName}`);
    console.log(`Caricato: ${result.url ?? result.pathname ?? fileName}`);
  }
}

async function runWithLimit(items, limit, worker) {
  let next = 0;
  async function runNext() {
    const i = next++;
    if (i >= items.length) return;
    try {
      await worker(items[i]);
    } catch (err) {
      console.error(`Errore su match ${items[i].mId}:`, err);
    }
    await runNext();
  }
  await Promise.all(Array.from({ length: limit }, runNext));
}

(async () => {
  console.time("total");
  if (CLEAN_BEFORE) {
    fs.rmSync(PREDICTIONS_DIR, { recursive: true, force: true });
    fs.rmSync(BLOG_DIR, { recursive: true, force: true });
    fs.rmSync(NEWS_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(PREDICTIONS_DIR, { recursive: true });
  fs.mkdirSync(BLOG_DIR, { recursive: true });
  fs.mkdirSync(NEWS_DIR, { recursive: true });

  const matches = await fetch(
    "http://10.0.0.32:5678/webhook/3c2a2651-5dd4-40ca-b5cd-5968b90a1233",
  ).then((r) => r.json());

  const allMatches = Object.keys(matches).flatMap((sid) => matches[sid]);

  fs.writeFileSync(MATCHES_FILE, JSON.stringify(allMatches));

  const pendingMatches = allMatches.filter(
    (match) => !fs.existsSync(`${BLOG_DIR}/${match.mId}.md`),
  );
  console.log(
    `Match totali: ${allMatches.length}, già fatti: ${allMatches.length - pendingMatches.length}, da fare: ${pendingMatches.length}`,
  );

  await runWithLimit(pendingMatches, LIMIT, processMatch);

  console.time("upload blogs");
  await uploadBlogsToCdn();
  console.timeEnd("upload blogs");

  console.timeEnd("total");
})();
