import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ANALYSIS_CATEGORIES,
  type AnalysisCategory,
} from '@/lib/config/analysis'
import type { Analysis, CategoryScore } from '@/types/analysis'
import { CategoryCard } from './CategoryCard'
import { ScoreBar } from './ScoreBar'

interface Props {
  analysis: Analysis
}

const RECOMMENDATION_LABELS: Record<
  Analysis['report_json']['recommended_next'],
  string
> = {
  continue: '계속 대화해보기',
  pause: '잠시 쉬었다가 다시',
  end: '여기서 마무리',
}

export function AnalysisReport({ analysis }: Props) {
  const report = analysis.report_json
  const score = Math.round(report.score)
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>호환성 점수</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-4xl font-semibold text-primary">{score}</div>
          <ScoreBar score={report.score} />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {ANALYSIS_CATEGORIES.map((category) => {
          const data = report.categories[category] as CategoryScore | undefined
          if (!data) return null
          return (
            <CategoryCard
              key={category}
              category={category as AnalysisCategory}
              data={data}
            />
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>요약</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {report.summary}
          </p>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">추천 다음 단계</span>
          <span className="text-sm font-medium">
            {RECOMMENDATION_LABELS[report.recommended_next]}
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
