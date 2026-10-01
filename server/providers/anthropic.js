import { readEventStream, upstreamError, ProviderError } from './stream.js';

// Claude (Anthropic Messages API), streamed.
export async function* streamAnthropic({ apiKey, model, baseUrl, system, prompt, image, signal }) {
  const response = await fetch(`${baseUrl ?? 'https://api.anthropic.com'}/v1/messages`, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0.2,
      stream: true,
      system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });
  if (!response.ok) throw await upstreamError('Claude', response);

  for await (const { event, data } of readEventStream(response.body)) {
    if (event === 'error') {
      let message = 'Claude stream error';
      try {
        message = JSON.parse(data).error?.message ?? message;
      } catch {
        /* keep default */
      }
      throw new ProviderError('provider_error', message);
    }
    if (event !== 'content_block_delta') continue;
    const payload = JSON.parse(data);
    if (payload.delta?.type === 'text_delta' && payload.delta.text) yield payload.delta.text;
  }
}
