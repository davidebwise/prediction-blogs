const test = require("node:test");
const assert = require("node:assert/strict");
const { validatePredictionArticle } = require("./predictionArticle.js");

const validCard = `# Pronóstico del partido

Una introducción breve.

<section class="prediction-card" data-market="1x2">
  <header class="prediction-card__header">
    <h2>1X2</h2>
    <p class="prediction-card__pick"><strong>Gana Flamengo</strong></p>
    <p class="prediction-card__confidence"><em>Confianza: Media-alta</em></p>
  </header>
  <ul class="prediction-card__signals">
    <li>✓ Flamengo mejora su producción como local</li>
    <li>✓ Cruzeiro concede más como visitante</li>
  </ul>
  <p class="prediction-card__risk"><strong>⚠ Riesgo:</strong> Cruzeiro mantiene capacidad para marcar.</p>
  <details class="prediction-card__details">
    <summary>Ver análisis completo</summary>
    <p>La producción reciente del local sostiene la elección.</p>
  </details>
</section>`;

test("acepta una card completa", () => {
  assert.deepEqual(validatePredictionArticle(validCard), []);
});

test("rechaza fórmulas repetitivas aunque tengan acentos o mayúsculas", () => {
  const article = validCard.replace(
    "La producción reciente",
    "LA RECOMENDACIÓN ES clara. La producción reciente",
  );
  assert.match(validatePredictionArticle(article).join(" "), /repetitivas/i);
});

test("rechaza card sin dropdown", () => {
  const article = validCard.replace(
    /  <details[\s\S]*?<\/details>\n/,
    "",
  );
  assert.match(validatePredictionArticle(article).join(" "), /details/);
});

test("rechaza mercados fuera de orden", () => {
  const over = validCard
    .replace('data-market="1x2"', 'data-market="over-under-25"')
    .replace("<h2>1X2</h2>", "<h2>Más/Menos de 2,5 goles</h2>");
  const article = `${over}\n${validCard}`;
  assert.match(validatePredictionArticle(article).join(" "), /orden/);
});
