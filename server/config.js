// Runtime configuration, read once from environment variables.
// Nothing here has a fake default: without a key, the feature is reported as not connected.

const env = process.env;

function clean(value) {
  const v = (value ?? '').trim();
  return v.length ? v : null;
}

const keys = {
  anthropic: clean(env.ANTHROPIC_API_KEY),
  openai: clean(env.OPENAI_API_KEY),
  gemini: clean(env.GEMINI_API_KEY),
};

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-5-5',
  openai: 'gpt-4.1',
  gemini: 'gemini-2.5-flash',
};

function pickProvider() {
  const explicit = clean(env.AI_PROVIDER)?.toLowerCase();
  if (explicit) {
    if (!(explicit in keys)) {
      throw new Error(`AI_PROVIDER must be one of: ${Object.keys(keys).join(', ')}`);
    }
    return keys[explicit] ? explicit : null;
  }
  return Object.keys(keys).find((name) => keys[name]) ?? null;
}

const provider = pickProvider();

export const config = {
  port: Number(env.PORT) || 8787,
  ai: provider
    ? {
        provider,
        apiKey: keys[provider],
        model: clean(env.AI_MODEL) ?? DEFAULT_MODELS[provider],
        baseUrl: clean(env.AI_BASE_URL),
        timeoutMs: Number(env.AI_TIMEOUT_MS) || 90_000,
      }
    : null,
  market:
    clean(env.EBAY_CLIENT_ID) && clean(env.EBAY_CLIENT_SECRET)
      ? {
          source: 'ebay',
          clientId: clean(env.EBAY_CLIENT_ID),
          clientSecret: clean(env.EBAY_CLIENT_SECRET),
          marketplace: clean(env.EBAY_MARKETPLACE) ?? 'EBAY_IT',
          baseUrl: clean(env.EBAY_API_BASE) ?? 'https://api.ebay.com',
        }
      : null,
  rateLimitPerHour: Number(env.RATE_LIMIT_PER_HOUR) || 40,
  maxImageBytes: 6 * 1024 * 1024,
};

// What the browser may know: only whether features are available. Never keys, providers or models.
export function publicConfig() {
  return {
    analysis: { available: Boolean(config.ai) },
    market: { available: Boolean(config.market) },
  };
}
