export const WORLD_CATEGORIES = [
  'news',
  'weather',
  'meme',
  'market',
  'politics',
  'sports',
  'other',
] as const

export type WorldCategory = (typeof WORLD_CATEGORIES)[number]

export interface WorldContextRow {
  id: string
  date: string // 'YYYY-MM-DD'
  category: WorldCategory
  headline: string
  details: string | null
  weight: number // 1–10
  source: string
  created_at: string
  updated_at: string
}

export interface WorldSnippet {
  items: WorldContextRow[]
  promptText: string
}
