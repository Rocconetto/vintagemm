import { readEventStream, upstreamError } from './stream.js';

// OpenAI Chat Completions (vision), streamed with JSON mode.
export async function* streamOpenAI({ apiKey, model, baseUrl, system, prompt, image, signal }) {
  const response = await fetch(`${baseUrl ?? 'https://api.openai.com'}/v1/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.base64}`, detail: 'high' } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) throw await upstreamError('OpenAI', response);

  for await (const { data } of readEventStream(response.body)) {
    if (data === '[DONE]') return;
    const text = JSON.parse(data).choices?.[0]?.delta?.content;
    if (text) yield text;
  }
}
