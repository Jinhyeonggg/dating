export const MOOD_PRIMARIES = [
  '평온',
  '설렘',
  '짜증',
  '우울',
  '활기',
  '피곤',
  '긴장',
] as const

export type MoodPrimary = (typeof MOOD_PRIMARIES)[number]

export interface MoodState {
  primary: MoodPrimary
  energy: number // 0.0 – 1.0
  openness: number // 0.0 – 1.0
  warmth: number // 0.0 – 1.0
  reason_hint: string // debug/log only
}
