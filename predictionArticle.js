const MARKET_ORDER = ["1x2", "over-under-25", "btts"];

const REPETITIVE_PHRASES = [
  "la recomendación es",
  "la recomendación principal es",
  "mi apuesta principal es",
  "la apuesta principal es",
  "la visión general es",
  "la lectura general es",
  "el pronóstico es",
  "mi pronóstico es",
  "la sugerencia es",
  "la apuesta sugerida es",
];

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

function validatePredictionArticle(article) {
  const errors = [];
  const text = typeof article === "string" ? article.trim() : "";

  if (!text) return ["La respuesta está vacía."];
  if (!/^# [^#\n]+/m.test(text)) {
    errors.push("Falta el título Markdown de nivel 1.");
  }
  if (text.includes("```")) {
    errors.push("La salida no debe estar envuelta en bloques de código.");
  }

  const markets = [
    ...text.matchAll(
      /<section class="prediction-card" data-market="([^"]+)">/g,
    ),
  ].map((match) => match[1]);

  if (markets.length === 0) {
    errors.push("Falta al menos una prediction card.");
  }
  if (new Set(markets).size !== markets.length) {
    errors.push("Cada mercado puede aparecer una sola vez.");
  }
  if (markets.some((market) => !MARKET_ORDER.includes(market))) {
    errors.push("Una card usa un data-market no válido.");
  }

  const expectedOrder = MARKET_ORDER.filter((market) => markets.includes(market));
  if (markets.join("|") !== expectedOrder.join("|")) {
    errors.push("Las cards no respetan el orden 1X2, Over/Under, BTTS.");
  }

  const counts = {
    sections: (text.match(/<section class="prediction-card"/g) || []).length,
    sectionEnds: (text.match(/<\/section>/g) || []).length,
    details: (text.match(/<details class="prediction-card__details">/g) || [])
      .length,
    detailEnds: (text.match(/<\/details>/g) || []).length,
    summaries: (text.match(/<summary>Ver análisis completo<\/summary>/g) || [])
      .length,
    picks: (text.match(/class="prediction-card__pick"/g) || []).length,
    confidence: (
      text.match(
        /class="prediction-card__confidence"><em>Confianza: (Alta|Media-alta|Media|Baja)<\/em>/g,
      ) || []
    ).length,
    signals: (text.match(/class="prediction-card__signals"/g) || []).length,
    risks: (text.match(/class="prediction-card__risk"/g) || []).length,
  };

  for (const [part, count] of Object.entries(counts)) {
    if (count !== counts.sections) {
      errors.push(
        `Cantidad no válida de ${part}: se esperaban ${counts.sections} y se encontraron ${count}.`,
      );
    }
  }

  const normalized = normalizeText(text);
  const repeated = REPETITIVE_PHRASES.filter((phrase) =>
    normalized.includes(normalizeText(phrase)),
  );
  if (repeated.length > 0) {
    errors.push(`Fórmulas repetitivas prohibidas: ${repeated.join(", ")}.`);
  }

  return errors;
}

module.exports = { REPETITIVE_PHRASES, validatePredictionArticle };
