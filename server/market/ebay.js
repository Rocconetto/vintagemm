// eBay Browse API: live listings used as market comparables.
// These are asking prices of active listings, never sold prices; the UI labels them that way.

let token = null; // { value, expiresAt }

async function getToken(market, signal) {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${market.clientId}:${market.clientSecret}`).toString('base64');
  const response = await fetch(`${market.baseUrl}/identity/v1/oauth2/token`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${basic}` },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }),
  });
  if (!response.ok) throw new Error(`eBay auth failed (${response.status})`);
  const json = await response.json();
  token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 7200) * 1000 };
  return token.value;
}

function toComparable(item) {
  const price = Number(item.price?.value);
  if (!item.itemWebUrl || !Number.isFinite(price) || price <= 0) return null;
  return {
    title: item.title ?? null,
    price: { value: price, currency: item.price.currency ?? 'EUR' },
    image: item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl ?? null,
    url: item.itemWebUrl,
    source: 'eBay',
    condition: item.condition ?? null,
    listedAt: item.itemCreationDate ?? item.itemOriginDate ?? null,
  };
}

export async function searchEbay(market, query, signal) {
  const accessToken = await getToken(market, signal);
  const params = new URLSearchParams({ q: query, limit: '12', filter: 'buyingOptions:{FIXED_PRICE}' });
  const response = await fetch(`${market.baseUrl}/buy/browse/v1/item_summary/search?${params}`, {
    signal,
    headers: { authorization: `Bearer ${accessToken}`, 'X-EBAY-C-MARKETPLACE-ID': market.marketplace },
  });
  if (!response.ok) throw new Error(`eBay search failed (${response.status})`);
  const json = await response.json();
  return (json.itemSummaries ?? []).map(toComparable).filter(Boolean);
}
