import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { getProvider } from '../providers/index.js';
import { ProviderError } from '../providers/stream.js';
import { findComparables } from '../market/index.js';
import { SYSTEM_PROMPT, USER_PROMPT } from './prompt.js';
import { normalizeAppraisal, parseModelJson } from './schema.js';
import { createPhaseTracker } from './phases.js';

export class AnalysisError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export async function runAnalysis({ image, emit, signal }) {
  if (!config.ai) throw new AnalysisError('not_connected', 'No AI provider is configured on this server.');

  const stream = getProvider(config.ai.provider);
  const phases = createPhaseTracker(emit);
  phases.start();

  const timeout = AbortSignal.timeout(config.ai.timeoutMs);
  const combined = AbortSignal.any([signal, timeout]);

  let output = '';
  try {
    for await (const chunk of stream({
      apiKey: config.ai.apiKey,
      model: config.ai.model,
      baseUrl: config.ai.baseUrl,
      system: SYSTEM_PROMPT,
      prompt: USER_PROMPT,
      image,
      signal: combined,
    })) {
      output += chunk;
      phases.observe(output);
    }
  } catch (error) {
    if (signal.aborted) throw error;
    if (timeout.aborted) throw new AnalysisError('timeout', 'The AI provider took too long to answer.');
    if (error instanceof ProviderError) throw new AnalysisError(error.code, error.message);
    throw new AnalysisError('provider_unavailable', error.message);
  }

  const raw = parseModelJson(output);
  if (!raw) throw new AnalysisError('invalid_output', 'The AI provider returned an unreadable answer.');
  const appraisal = normalizeAppraisal(raw);
  phases.finishModel();

  if (!appraisal.recognized) {
    throw new AnalysisError('unrecognized', appraisal.unrecognizedReason ?? 'The item could not be identified.');
  }

  let market;
  if (config.market && appraisal.marketQuery) {
    phases.set('market', 'active');
    market = await findComparables(config.market, appraisal.marketQuery, signal);
    phases.set('market', market.status === 'error' ? 'failed' : 'done');
  } else {
    market = await findComparables(config.market, appraisal.marketQuery, signal);
    phases.set('market', 'skipped');
  }

  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...appraisal,
    market,
  };
}
