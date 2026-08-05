// webhook matches
// http://10.0.0.32:5678/webhook/3c2a2651-5dd4-40ca-b5cd-5968b90a1233
//

const { Init } = require("./matchService.js");
const fs = require("node:fs");
const { Agent } = require("undici");

const PREDICTIONS_DIR = "data/predictions";
const BLOG_DIR = "data/blogs";
const LIMIT = 1;

//const OLLAMA_HOST = "http://vps-921c83db.vps.ovh.net:11434";
//const OLLAMA_MODEL = "qwen3.5-27b-q5";
//const OLLAMA_MODEL = "openrouter/free";

const OLLAMA_HOST = "http://localhost:11434";
const OLLAMA_MODEL = "openai-codex/gpt-5.6-luna";

const OLLAMA_TIMEOUT_MS = 30 * 60 * 1000; // 30 minuti, LLM locale può essere lento

const ollamaAgent = new Agent({
  headersTimeout: OLLAMA_TIMEOUT_MS,
  bodyTimeout: OLLAMA_TIMEOUT_MS,
});

const BLOG_SYSTEM_PROMPT = fs.readFileSync(
  "blog-article-es-prompt.md",
  "utf-8",
);

async function generateBlogArticle(prediction) {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      think: "low",
      stream: false,
      messages: [
        { role: "system", content: BLOG_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(prediction) },
      ],
    }),
    dispatcher: ollamaAgent,
  }).then((r) => r.json());

  return res.message.content;
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

  console.time(`blog ${match.home}-${match.away}||${match.mId}`);
  const article = await generateBlogArticle(prediction);
  console.timeEnd(`blog ${match.home}-${match.away}||${match.mId}`);
  fs.writeFileSync(`${BLOG_DIR}/${match.mId}.md`, article);
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
    await worker(items[i]);
    await runNext();
  }
  await Promise.all(Array.from({ length: limit }, runNext));
}

(async () => {
  console.time("total");
  fs.rmSync(PREDICTIONS_DIR, { recursive: true, force: true });
  fs.rmSync(BLOG_DIR, { recursive: true, force: true });
  fs.mkdirSync(PREDICTIONS_DIR, { recursive: true });
  fs.mkdirSync(BLOG_DIR, { recursive: true });

  const matches = await fetch(
    "http://10.0.0.32:5678/webhook/3c2a2651-5dd4-40ca-b5cd-5968b90a1233",
  ).then((r) => r.json());

  const allMatches = Object.keys(matches).flatMap((sid) => matches[sid]);

  await runWithLimit(allMatches, LIMIT, processMatch);

  console.time("upload blogs");
  await uploadBlogsToCdn();
  console.timeEnd("upload blogs");

  console.timeEnd("total");
})();
