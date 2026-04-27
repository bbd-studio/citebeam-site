/**
 * Single source of truth for chat-agent LLM choice.
 *
 * Edit this file when swapping the primary model. The API route at
 * src/app/api/chat/route.ts and the UI at src/app/unilever/chat/page.tsx
 * both import from here so the footer and the actual upstream call stay
 * in sync automatically.
 */

export type AgentProvider =
  | { key: "deepseek"; model: "deepseek-v4-flash"; displayName: "DeepSeek V4" }
  | { key: "zhipu"; model: "GLM-4.5-air"; displayName: "智谱 GLM-4.5-air" }
  | { key: "minimax"; model: "MiniMax-M2"; displayName: "MiniMax-M2" };

export const AGENT_CASCADE: AgentProvider[] = [
  {
    key: "deepseek",
    // V4 GA 2026-04-24. deepseek-chat / deepseek-reasoner retire 2026-07-24.
    // v4-flash = non-thinking mode (matches the old deepseek-chat behavior).
    // Use v4-pro if you want thinking mode (slower, more reasoning tokens).
    model: "deepseek-v4-flash",
    displayName: "DeepSeek V4",
  },
  {
    key: "zhipu",
    model: "GLM-4.5-air",
    displayName: "智谱 GLM-4.5-air",
  },
];

export const PROVIDER_ENDPOINTS: Record<string, string> = {
  deepseek: "https://api.deepseek.com/v1/chat/completions",
  zhipu: "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions",
  minimax: "https://api.minimaxi.chat/v1/chat/completions",
};

export const PROVIDER_ENV_VARS: Record<string, string> = {
  deepseek: "DEEPSEEK_API_KEY",
  zhipu: "ZHIPU_API_KEY",
  minimax: "MINIMAX_API_KEY",
};
