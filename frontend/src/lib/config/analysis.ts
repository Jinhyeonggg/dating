export const ANALYSIS_CATEGORIES = [
  'conversation_flow',
  'shared_interests',
  'values_alignment',
  'communication_fit',
  'potential_conflicts',
] as const

export type AnalysisCategory = (typeof ANALYSIS_CATEGORIES)[number]

export const ANALYSIS_CATEGORY_LABELS: Record<AnalysisCategory, string> = {
  conversation_flow: '대화 흐름',
  shared_interests: '공통 관심사',
  values_alignment: '가치관 일치',
  communication_fit: '커뮤니케이션 궁합',
  potential_conflicts: '잠재 갈등 지점',
}
