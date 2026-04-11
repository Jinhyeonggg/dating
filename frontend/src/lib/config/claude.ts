export const CLAUDE_MODELS = {
  INTERACTION: 'claude-sonnet-4-6',
  EXTRACTION: 'claude-haiku-4-5-20251001',
  ANALYSIS: 'claude-sonnet-4-6',
} as const

export const CLAUDE_RETRY = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY_MS: 1000,
  BACKOFF_MULTIPLIER: 2,
} as const

export const CLAUDE_LIMITS = {
  MAX_OUTPUT_TOKENS_INTERACTION: 512,
  MAX_OUTPUT_TOKENS_EXTRACTION: 256,
  MAX_OUTPUT_TOKENS_ANALYSIS: 2048,
} as const
