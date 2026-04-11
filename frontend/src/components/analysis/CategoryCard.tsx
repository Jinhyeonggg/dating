import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ANALYSIS_CATEGORY_LABELS,
  type AnalysisCategory,
} from '@/lib/config/analysis'
import type { CategoryScore } from '@/types/analysis'
import { ScoreBar } from './ScoreBar'

interface Props {
  category: AnalysisCategory
  data: CategoryScore
}

export function CategoryCard({ category, data }: Props) {
  const label = ANALYSIS_CATEGORY_LABELS[category]
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{label}</span>
          <span className="text-sm font-semibold text-primary">
            {Math.round(data.score)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <ScoreBar score={data.score} />
        <p className="text-xs text-muted-foreground">{data.comment}</p>
      </CardContent>
    </Card>
  )
}
