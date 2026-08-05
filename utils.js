function clamp(value, min = -1, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  const clean = values.filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (clean.length === 0) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

// Home-advantage style diff: positive favors home, negative favors away, range [-1, 1].
function relativeAdvantage(homeValue, awayValue) {
  if (homeValue == null || awayValue == null) return 0;
  const total = homeValue + awayValue;
  if (total === 0) return 0;
  return clamp((homeValue - awayValue) / total);
}

function daysBetween(dateA, dateB) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.abs(new Date(dateA) - new Date(dateB)) / msPerDay;
}

module.exports = { clamp, average, relativeAdvantage, daysBetween };
