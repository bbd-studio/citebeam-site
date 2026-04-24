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
  mention_rate: number;
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

export type CategoryReport = {
  n_queries: number;
  n_errors: number;
  unique_prompts: number;
  unilever_brands: BrandStat[];
  competitors: BrandStat[];
  platform_stats: PlatformStat[];
  failed_prompts: FailedPrompt[];
  strengths_weaknesses: Record<string, BrandSW>;
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
