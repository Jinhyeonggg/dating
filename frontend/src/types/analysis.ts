export interface CategoryScore {
  score: number
  comment: string
}

export interface AnalysisReport {
  score: number  // 0-100
  categories: Record<string, CategoryScore>
  summary: string
  recommended_next: 'continue' | 'pause' | 'end'
}

export interface Analysis {
  id: string
  interaction_id: string
  score: number
  report_json: AnalysisReport
  model: string
  created_at: string
}
