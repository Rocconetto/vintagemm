import { readEventStream, upstreamError } from './stream.js';

// Google Gemini (generateContent), streamed as SSE with JSON output.
export async function* streamGemini({ apiKey, model, baseUrl, system, prompt, image, signal }) {
  const base = baseUrl ?? 'https://generativelanguage.googleapis.com';
  const response = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [
        {
          role: 'user',
          parts: [{ inline_data: { mime_type: image.mediaType, data: image.base64 } }, { text: prompt }],
        },
      ],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });
  if (!response.ok) throw await upstreamError('Gemini', response);

  for await (const { data } of readEventStream(response.body)) {
    const parts = JSON.parse(data).candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) if (part.text) yield part.text;
  }
}
