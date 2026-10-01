// Reads a text/event-stream HTTP response body and yields { event, data } records.

export async function* readEventStream(body) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let boundary;
    while ((boundary = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, '');
      const record = parseRecord(raw);
      if (record) yield record;
    }
  }
  const tail = parseRecord(buffer);
  if (tail) yield tail;
}

function parseRecord(raw) {
  let event = 'message';
  const data = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    const idx = line.indexOf(':');
    const field = idx === -1 ? line : line.slice(0, idx);
    const value = idx === -1 ? '' : line.slice(idx + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  return data.length ? { event, data: data.join('\n') } : null;
}

export class ProviderError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Maps an upstream HTTP failure to a stable error code the UI understands.
export async function upstreamError(provider, response) {
  let detail = '';
  try {
    detail = (await response.text()).slice(0, 400);
  } catch {
    /* body unavailable */
  }
  const status = response.status;
  if (status === 401 || status === 403) return new ProviderError('provider_auth', `${provider} rejected the API key`, status);
  if (status === 429) return new ProviderError('provider_busy', `${provider} rate limit reached`, status);
  if (status >= 500) return new ProviderError('provider_unavailable', `${provider} is unavailable (${status})`, status);
  return new ProviderError('provider_error', `${provider} request failed (${status}): ${detail}`, status);
}
