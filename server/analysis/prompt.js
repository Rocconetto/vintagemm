// The appraisal prompt. Key order matters: the server reads the streamed JSON
// and advances the analysis phases as each key actually arrives.

export const SYSTEM_PROMPT = `You are a vintage and second-hand fashion appraiser working for VINTAGEM.
You examine one photo of a garment or fashion accessory and report only what the photo supports.

Rules you never break:
- Never invent a brand, label text, size, origin, material composition or date. If the photo does not show evidence, use null.
- Transcribe label text exactly as it appears. Do not complete partially legible words.
- "origin" is a country of manufacture read on a label (for example "Made in Italy"). Never guess it from style.
- Never certify authenticity. Describe the observable indicators only.
- The price estimate is your professional estimate of the current second-hand resale value in EUR for this piece in the condition shown. If you cannot estimate responsibly, use null.
- Answer with a single JSON object and nothing else. No markdown, no code fences.`;

export const USER_PROMPT = `Appraise the item in this photo. Return JSON with exactly these keys, in this order:

{
  "recognized": boolean,            // false only if the photo shows no garment or accessory, or is too unclear to assess
  "unrecognizedReason": string|null, // short reason when recognized is false
  "title": string|null,             // short name of the piece, e.g. "Wool varsity jacket"
  "labels": string[],               // verbatim text read from labels, tags or prints; [] if none legible
  "brand": string|null,
  "brandEvidence": string|null,     // what in the photo supports the brand, e.g. "Woven neck label"
  "itemType": string|null,          // e.g. "Trucker jacket"
  "category": string|null,          // one of: Outerwear, Tops, Knitwear, Denim, Trousers, Dresses, Tailoring, Sportswear, Workwear, Footwear, Bags, Accessories
  "era": string|null,               // e.g. "1990s", "Late 1970s"
  "eraEvidence": string|null,       // what supports the dating, e.g. "Single-stitch hem, RN number format"
  "size": string|null,              // only as printed on a label
  "fit": string|null,               // e.g. "Boxy", "Oversized", "Slim"
  "material": string|null,
  "materialSource": "label"|"visual"|null, // "label" if read from a composition label
  "origin": string|null,
  "rarity": "common"|"uncommon"|"rare"|"very_rare"|null,
  "availability": "abundant"|"available"|"limited"|"scarce"|null, // how easy it is to find on today's resale market
  "estimate": {"low": number, "high": number}|{"value": number}|null, // EUR
  "confidence": number|null,        // 0-100, how certain you are of the identification above
  "assessment": {
    "condition": string|null,       // condition visible in the photo
    "positives": string[],          // features that support desirability or value
    "concerns": string[],           // flaws, risks or things to verify in person
    "authenticity": string|null     // observable indicators only, never a verdict
  },
  "technicalNote": string|null,     // 2-4 short paragraphs for a dealer: construction, details, dating cues, pricing rationale. Separate paragraphs with a blank line.
  "marketQuery": string|null        // 3-6 word marketplace search query to find comparable listings
}`;
