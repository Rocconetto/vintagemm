import type { Appraisal, Availability, Rarity } from './types';

const money = new Map<string, Intl.NumberFormat>();

export function formatMoney(value: number, currency = 'EUR') {
  if (!money.has(currency)) {
    money.set(currency, new Intl.NumberFormat('en-IE', { style: 'currency', currency, maximumFractionDigits: 0 }));
  }
  return money.get(currency)!.format(value);
}

export function formatDate(iso: string, withYear = true) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  very_rare: 'Very rare',
};

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  abundant: 'Easy to find',
  available: 'Available',
  limited: 'Limited',
  scarce: 'Scarce',
};

export function estimateText(a: Appraisal) {
  const e = a.estimate;
  if (!e) return null;
  return e.value != null ? formatMoney(e.value) : `${formatMoney(e.low)}–${formatMoney(e.high)}`;
}

// Sort key for "highest value": midpoint of a range, or the single value.
export function estimateMid(a: Appraisal) {
  const e = a.estimate;
  if (!e) return -1;
  return e.value != null ? e.value : (e.low + e.high) / 2;
}

export function displayName(a: Appraisal) {
  return a.title ?? a.itemType ?? 'Unnamed piece';
}

export function shortRef(id: string) {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

// Vintage DNA: a typographic composition built only from attributes the appraisal established.
export interface DnaToken {
  kind: 'era' | 'origin' | 'material' | 'rarity' | 'category';
  label: string;
}

export function dnaTokens(a: Appraisal): DnaToken[] {
  const tokens: DnaToken[] = [];
  if (a.era) tokens.push({ kind: 'era', label: a.era });
  if (a.origin) tokens.push({ kind: 'origin', label: /made in/i.test(a.origin) ? a.origin : `Made in ${a.origin}` });
  if (a.material) tokens.push({ kind: 'material', label: a.material.length > 36 ? a.material.split(/[,;/]/)[0].trim() : a.material });
  if (a.rarity) tokens.push({ kind: 'rarity', label: RARITY_LABEL[a.rarity] });
  if (a.category) tokens.push({ kind: 'category', label: a.category });
  return tokens;
}
