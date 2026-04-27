export type SampleAnswer = {
  prompt: string;
  platform: string;
  answer: string;
};

export type BrandStat = {
  key: string;
  display: string;
  tier: string;
  is_client: boolean;
  mentions: number;
  mention_rate: number;
  per_platform: Record<string, number>;
  sample_answers: SampleAnswer[];
};

export type PlatformStat = {
  platform: string;
  total: number;
  errors: number;
  avg_latency_ms: number;
  mention_rate: number;                  // % of queries that mentioned any Unilever brand
  competitor_mention_rate?: number;      // % that mentioned any tracked competitor
  top_unilever?: { key: string; display: string; mentions: number } | null;
  top_competitor?: { key: string; display: string; mentions: number } | null;
};

export type FailedPrompt = {
  prompt: string;
  pushed_brands: { key: string; display: string }[];
};

export type DimEntry = {
  value: string;
  hits: number;
  total: number;
  rate: number;
  top_competitor: { key: string; display: string; hits: number } | null;
};

export type DimAnalysis = {
  strong: DimEntry[];
  weak: DimEntry[];
  overall_rate: number;
};

export type BrandSW = Partial<Record<
  "scenario" | "persona" | "attribute" | "price_tier" | "intent",
  DimAnalysis
>>;

export type DarkHorseCompetitor = { name: string; mentions: number };

export type CategoryReport = {
  n_queries: number;
  n_errors: number;
  unique_prompts: number;
  unilever_brands: BrandStat[];
  competitors: BrandStat[];
  platform_stats: PlatformStat[];
  failed_prompts: FailedPrompt[];
  strengths_weaknesses: Record<string, BrandSW>;
  dark_horse_competitors?: DarkHorseCompetitor[];
};

export type UnileverReport = {
  meta: {
    generated_at: string;
    source_file: string;
    total_queries: number;
    total_errors: number;
    platforms: string[];
  };
  categories: Record<string, CategoryReport>;
};

// ── Timeline page types ──────────────────────────────────────────────────

export type TimelineDay = {
  date: string;       // YYYY-MM-DD
  l1: number;
  l2: number;
  l1_err: number;
  l2_err: number;
};

export type PlatformRollup = {
  platform: string;
  l1_ok: number;
  l1_err: number;
  l2_ok: number;
  l2_err: number;
  citations: number;
  models: string[];
  has_l2: boolean;
};

export type TimelineCitation = {
  url: string | null;
  domain: string | null;
  title: string | null;
  position: number | null;
};

export type TimelineSampleSide = {
  id: number;
  created_at: string;
  model: string;
  excerpt: string;
  brand_hits: string[];
  input_tokens: number;
  output_tokens: number;
  cost_cny: number;
  latency_ms: number;
  citations?: TimelineCitation[];   // L2 only
};

export type TimelinePair = {
  prompt_id: number;
  prompt: string;
  category: string;
  platform: string;
  l1: TimelineSampleSide;
  l2: TimelineSampleSide;
  diff: {
    only_l1: string[];
    only_l2: string[];
    both: string[];
  };
};

export type TimelineBundle = {
  meta: {
    generated_at: string;
    customer: string;
    total_l1: number;
    total_l2: number;
    total_l1_errors: number;
    total_l2_errors: number;
    total_citations: number;
    total_pairs: number;
    platforms_with_l2: string[];
    first_sample: string;
    last_sample: string;
  };
  timeline: TimelineDay[];
  by_platform: PlatformRollup[];
  pairs: TimelinePair[];
};
