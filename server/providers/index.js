import { streamAnthropic } from './anthropic.js';
import { streamOpenAI } from './openai.js';
import { streamGemini } from './gemini.js';

// To add a provider: write an async generator that yields text chunks, then register it here.
const providers = {
  anthropic: streamAnthropic,
  openai: streamOpenAI,
  gemini: streamGemini,
};

export function getProvider(name) {
  const stream = providers[name];
  if (!stream) throw new Error(`Unknown AI provider: ${name}`);
  return stream;
}
