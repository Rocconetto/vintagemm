// Shape of an appraisal as produced by server/analysis (normalized there).
// Every optional field is null when the analysis did not establish it.

export type Rarity = 'common' | 'uncommon' | 'rare' | 'very_rare';
export type Availability = 'abundant' | 'available' | 'limited' | 'scarce';

export type Estimate =
  | { currency: 'EUR'; value: number; low?: undefined; high?: undefined }
  | { currency: 'EUR'; low: number; high: number; value?: undefined };

export interface Comparable {
  title: string | null;
  price: { value: number; currency: string };
  image: string | null;
  url: string;
  source: string;
  condition: string | null;
  listedAt: string | null;
}

export interface MarketBlock {
  status: 'ok' | 'empty' | 'error' | 'not_connected' | 'no_query';
  source: string | null;
  query: string | null;
  items: Comparable[];
  summary: { kind: 'asking'; count: number; currency: string; median: number } | null;
}

export interface Appraisal {
  id: string;
  createdAt: string;
  title: string | null;
  labels: string[];
  brand: string | null;
  brandEvidence: string | null;
  itemType: string | null;
  category: string | null;
  era: string | null;
  eraEvidence: string | null;
  size: string | null;
  fit: string | null;
  material: string | null;
  materialSource: 'label' | 'visual' | null;
  origin: string | null;
  rarity: Rarity | null;
  availability: Availability | null;
  estimate: Estimate | null;
  confidence: number | null;
  assessment: {
    condition: string | null;
    positives: string[];
    concerns: string[];
    authenticity: string | null;
  };
  technicalNote: string | null;
  marketQuery: string | null;
  market: MarketBlock;
}

export interface ArchiveRecord {
  id: string;
  createdAt: string;
  appraisal: Appraisal;
  photo: Blob;
  thumb: Blob;
}

export type PhaseId = 'scan' | 'labels' | 'brand' | 'era' | 'material' | 'rarity' | 'value' | 'market';
export type PhaseStatus = 'pending' | 'active' | 'done' | 'skipped' | 'failed';

export type AnalysisErrorCode =
  | 'not_connected'
  | 'unrecognized'
  | 'invalid_image'
  | 'image_too_large'
  | 'rate_limited'
  | 'timeout'
  | 'network'
  | 'provider_auth'
  | 'provider_busy'
  | 'provider_unavailable'
  | 'provider_error'
  | 'invalid_output'
  | 'internal';

export interface ServerConfig {
  analysis: { available: boolean };
  market: { available: boolean };
}
