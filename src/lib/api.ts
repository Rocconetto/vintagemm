import type { Appraisal, AnalysisErrorCode, PhaseId, PhaseStatus, ServerConfig } from './types';
import { AnalysisFailure } from './errors';

export { AnalysisFailure };

export async function fetchConfig(): Promise<ServerConfig | null> {
  try {
    const res = await fetch('/api/config');
    return res.ok ? ((await res.json()) as ServerConfig) : null;
  } catch {
    return null;
  }
}

// Sends the photo to the VINTAGEM backend and follows its event stream until a result or an error arrives.
// The browser never talks to an AI provider and never holds a key: the backend does both.
export async function analyze(
  photo: { dataUrl: string },
  onPhase: (id: PhaseId, status: PhaseStatus) => void,
  signal: AbortSignal,
): Promise<Appraisal> {
  const imageDataUrl = photo.dataUrl;
  let res: Response;
  try {
    res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image: imageDataUrl }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new AnalysisFailure('network', 'The server could not be reached.');
  }

  if (!res.ok || !res.body) {
    let code: AnalysisErrorCode = res.status === 429 ? 'rate_limited' : 'internal';
    let message = `Request failed (${res.status})`;
    try {
      const json = await res.json();
      code = json.error?.code ?? code;
      message = json.error?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new AnalysisFailure(code, message);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let event = 'message';
        let data = '';
        for (const line of raw.split('\n')) {
          if (line.startsWith('event: ')) event = line.slice(7);
          else if (line.startsWith('data: ')) data += line.slice(6);
        }
        if (!data) continue;
        const payload = JSON.parse(data);
        if (event === 'phase') onPhase(payload.id, payload.status);
        else if (event === 'result') return payload as Appraisal;
        else if (event === 'error') throw new AnalysisFailure(payload.code, payload.message);
      }
    }
  } catch (error) {
    if (error instanceof AnalysisFailure || signal.aborted) throw error;
    throw new AnalysisFailure('network', 'The connection dropped during the appraisal.');
  }
  throw new AnalysisFailure('network', 'The appraisal ended without a result.');
}
