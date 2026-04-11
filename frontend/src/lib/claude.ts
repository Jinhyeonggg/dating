import Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_MODELS, CLAUDE_RETRY, CLAUDE_LIMITS } from '@/lib/config/claude'
import { errors, AppError } from '@/lib/errors'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (client) return client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new AppError(
      'INTERNAL',
      'ANTHROPIC_API_KEY 가 설정되지 않았습니다',
      500
    )
  }
  client = new Anthropic({ apiKey })
  return client
}

export interface ClaudeCallOptions {
  model: string
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens: number
  temperature?: number
}

/**
 * Claude API를 호출한다. 429 / 5xx / 네트워크 에러에 지수 백오프 재시도.
 * 재시도 후에도 실패하면 AppError('LLM_ERROR') throw.
 */
export async function callClaude(options: ClaudeCallOptions): Promise<string> {
  const c = getClient()
  let lastError: unknown = null

  for (let attempt = 0; attempt < CLAUDE_RETRY.MAX_ATTEMPTS; attempt++) {
    try {
      const response = await c.messages.create({
        model: options.model,
        system: options.system,
        messages: options.messages,
        max_tokens: options.maxTokens,
        temperature: options.temperature ?? 0.9,
      })
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
      if (!text) {
        throw new Error('empty response from Claude')
      }
      return text
    } catch (err) {
      lastError = err
      const retriable = isRetriable(err)
      if (!retriable || attempt === CLAUDE_RETRY.MAX_ATTEMPTS - 1) break
      const delay =
        CLAUDE_RETRY.INITIAL_DELAY_MS *
        Math.pow(CLAUDE_RETRY.BACKOFF_MULTIPLIER, attempt)
      await sleep(delay)
    }
  }
  throw errors.llm(lastError instanceof Error ? lastError : new Error(String(lastError)))
}

function isRetriable(err: unknown): boolean {
  if (!(err instanceof Anthropic.APIError)) return true // 네트워크 등
  const status = err.status
  if (status === 429) return true
  if (status && status >= 500) return true
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export { CLAUDE_MODELS, CLAUDE_LIMITS }
