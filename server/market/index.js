import { searchEbay } from './ebay.js';

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Returns a market block for an appraisal. Status is always explicit, so the UI
// never has to guess why comparables are missing.
export async function findComparables(market, query, signal) {
  if (!market) return { status: 'not_connected', source: null, query, items: [], summary: null };
  if (!query) return { status: 'no_query', source: market.source, query: null, items: [], summary: null };

  try {
    const items = await searchEbay(market, query, signal);
    if (!items.length) return { status: 'empty', source: market.source, query, items: [], summary: null };

    // Summarise only listings in the dominant currency so the median is meaningful.
    const counts = new Map();
    for (const item of items) counts.set(item.price.currency, (counts.get(item.price.currency) ?? 0) + 1);
    const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const prices = items.filter((i) => i.price.currency === currency).map((i) => i.price.value);

    return {
      status: 'ok',
      source: market.source,
      query,
      items,
      summary: { kind: 'asking', count: prices.length, currency, median: Math.round(median(prices)) },
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    console.error('[market]', error.message);
    return { status: 'error', source: market.source, query, items: [], summary: null };
  }
}
