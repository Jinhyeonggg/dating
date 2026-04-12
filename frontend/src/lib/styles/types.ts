export interface StyleCardMatch {
  age_range?: [number, number]
  gender?: Array<'여성' | '남성' | '중립'>
  register?: 'formal' | 'casual' | 'mixed'
  energy?: 'low' | 'mid' | 'high'
  humor?: 'dry' | 'playful' | 'warm' | 'none'
  mbti_like?: string[]
  tags?: string[]
}

export interface StyleCard {
  id: string
  label: string
  match: StyleCardMatch
  sample: string
  texture_notes?: string
}
