'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { InferredTraits } from '@/types/onboarding'

interface TraitsPreviewProps {
  traits: InferredTraits
  onConfirm: () => void
  onRetry: () => void
  confirming: boolean
}

export function TraitsPreview({ traits, onConfirm, onRetry, confirming }: TraitsPreviewProps) {
  const rows = [
    { label: '성격', value: traits.personality_summary },
    { label: '소통 스타일', value: traits.communication_tendency },
    { label: '사회적 스타일', value: traits.social_style },
    { label: '가치관', value: traits.value_priorities.join(', ') },
    { label: '갈등 대처', value: traits.conflict_style },
    { label: '에너지 패턴', value: traits.energy_pattern },
    { label: '관심 대화 주제', value: traits.conversation_topics.join(', ') },
  ]

  return (
    <Card className="mx-auto max-w-lg p-6">
      <h2 className="mb-4 text-lg font-semibold">AI가 파악한 당신의 성격</h2>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <span className="text-sm font-medium text-muted-foreground">{r.label}</span>
            <p className="text-sm">{r.value || '-'}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={onRetry} disabled={confirming}>
          다시 하기
        </Button>
        <Button onClick={onConfirm} disabled={confirming}>
          {confirming ? '저장 중...' : '확인'}
        </Button>
      </div>
    </Card>
  )
}
