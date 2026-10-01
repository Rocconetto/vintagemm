// Turns raw model output into a strict, honest appraisal object.
// Anything missing, empty or placeholder-like becomes null so the UI can say "not determined".

const PLACEHOLDERS = /^(unknown|n\/?a|none|null|undefined|not (visible|available|determined|legible|applicable)|unclear|-+|\?+)$/i;

const RARITY = ['common', 'uncommon', 'rare', 'very_rare'];
const AVAILABILITY = ['abundant', 'available', 'limited', 'scarce'];
const CATEGORIES = [
  'Outerwear', 'Tops', 'Knitwear', 'Denim', 'Trousers', 'Dresses', 'Tailoring',
  'Sportswear', 'Workwear', 'Footwear', 'Bags', 'Accessories',
];

export function text(value, max = 160) {
  if (typeof value !== 'string') return null;
  const v = value.replace(/\s+/g, ' ').trim();
  if (!v || PLACEHOLDERS.test(v)) return null;
  return v.length > max ? `${v.slice(0, max - 1).trimEnd()}…` : v;
}

function paragraphs(value, max = 2400) {
  if (typeof value !== 'string') return null;
  const parts = value
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const joined = parts.join('\n\n');
  return joined.length > max ? `${joined.slice(0, max - 1).trimEnd()}…` : joined;
}

function list(value, maxItems = 8, maxLen = 160) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const t = text(item, maxLen);
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
    if (out.length >= maxItems) break;
  }
  return out;
}

function enumValue(value, allowed) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return allowed.includes(v) ? v : null;
}

function money(value) {
  const n = typeof value === 'string' ? Number(value.replace(/[^\d.]/g, '')) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return Math.round(n);
}

function estimate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  let low = money(raw.low);
  let high = money(raw.high);
  const value = money(raw.value);
  if (low != null && high != null) {
    if (low > high) [low, high] = [high, low];
    if (low === high) return { currency: 'EUR', value: low };
    return { currency: 'EUR', low, high };
  }
  const single = value ?? low ?? high;
  return single != null ? { currency: 'EUR', value: single } : null;
}

function confidence(raw) {
  let n = typeof raw === 'string' ? Number(raw.replace('%', '')) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  if (n > 0 && n <= 1) n *= 100;
  if (n < 0 || n > 100) return null;
  return Math.round(n);
}

export function parseModelJson(output) {
  const cleaned = output.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function normalizeAppraisal(raw) {
  const category = text(raw.category, 40);
  const assessment = raw.assessment && typeof raw.assessment === 'object' ? raw.assessment : {};
  const material = text(raw.material, 120);

  return {
    recognized: raw.recognized !== false,
    unrecognizedReason: text(raw.unrecognizedReason, 200),
    title: text(raw.title, 80),
    labels: list(raw.labels, 10, 120),
    brand: text(raw.brand, 60),
    brandEvidence: text(raw.brandEvidence),
    itemType: text(raw.itemType, 60),
    category: CATEGORIES.find((c) => c.toLowerCase() === category?.toLowerCase()) ?? null,
    era: text(raw.era, 40),
    eraEvidence: text(raw.eraEvidence),
    size: text(raw.size, 30),
    fit: text(raw.fit, 40),
    material,
    materialSource: material ? enumValue(raw.materialSource, ['label', 'visual']) : null,
    origin: text(raw.origin, 60),
    rarity: enumValue(raw.rarity, RARITY),
    availability: enumValue(raw.availability, AVAILABILITY),
    estimate: estimate(raw.estimate),
    confidence: confidence(raw.confidence),
    assessment: {
      condition: text(assessment.condition, 300),
      positives: list(assessment.positives, 6),
      concerns: list(assessment.concerns, 6),
      authenticity: text(assessment.authenticity, 400),
    },
    technicalNote: paragraphs(raw.technicalNote),
    marketQuery: text(raw.marketQuery, 80),
  };
}
