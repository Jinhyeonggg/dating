'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { OnboardingQuestion } from '@/types/onboarding'

interface OnboardingCardProps {
  question: OnboardingQuestion
  value: string
  onChange: (value: string) => void
  onNext: () => void
  canNext: boolean
  current: number
  total: number
}

export function OnboardingCard({
  question,
  value,
  onChange,
  onNext,
  canNext,
  current,
  total,
}: OnboardingCardProps) {
  return (
    <Card className="mx-auto max-w-lg p-6">
      {/* 진행 바 */}
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <span>{current} / {total}</span>
        <div className="h-1.5 flex-1 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>
      </div>

      <p className="mb-6 text-lg font-medium">{question.text}</p>

      {question.type === 'scenario' ? (
        <textarea
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          rows={4}
          placeholder="자유롭게 답변해 주세요..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {question.choices?.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                value === c.id
                  ? 'border-primary bg-primary/10 font-medium'
                  : 'border-border hover:bg-muted'
              }`}
              onClick={() => onChange(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button onClick={onNext} disabled={!canNext}>
          {current === total ? '분석하기' : '다음'}
        </Button>
      </div>
    </Card>
  )
}
