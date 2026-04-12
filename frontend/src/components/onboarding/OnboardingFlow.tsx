'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ONBOARDING_QUESTIONS } from '@/lib/constants/onboardingQuestions'
import { OnboardingCard } from './OnboardingCard'
import { TraitsPreview } from './TraitsPreview'
import type { OnboardingAnswer, InferredTraits } from '@/types/onboarding'

type Phase = 'questions' | 'analyzing' | 'error' | 'preview'

interface OnboardingFlowProps {
  cloneId: string
}

export function OnboardingFlow({ cloneId }: OnboardingFlowProps) {
  const router = useRouter()
  const questions = ONBOARDING_QUESTIONS
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [phase, setPhase] = useState<Phase>('questions')
  const [traits, setTraits] = useState<InferredTraits | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const currentQ = questions[currentIndex]
  const currentValue = answers.get(currentQ?.id ?? '') ?? ''

  function handleChange(value: string) {
    setAnswers((prev) => new Map(prev).set(currentQ.id, value))
  }

  async function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1)
      return
    }
    // 마지막 질문 → 분석
    setPhase('analyzing')
    setError(null)
    try {
      const answerList: OnboardingAnswer[] = Array.from(answers.entries()).map(
        ([questionId, value]) => ({ questionId, value })
      )
      const res = await fetch(`/api/clones/${cloneId}/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerList }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error?.message ?? '분석 실패')
      }
      const { inferredTraits } = await res.json()
      setTraits(inferredTraits)
      setPhase('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류')
      setPhase('error')
    }
  }

  function handleRetry() {
    setCurrentIndex(0)
    setAnswers(new Map())
    setTraits(null)
    setPhase('questions')
  }

  function handleConfirm() {
    setConfirming(true)
    // traits는 이미 API에서 저장됨 → 바로 이동
    router.push(`/clones/${cloneId}`)
  }

  if (phase === 'analyzing') {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <div className="mb-4 flex items-center justify-center gap-2 text-2xl">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          분석 중...
        </div>
        <p className="text-sm text-muted-foreground">AI가 응답을 분석하고 있습니다. 최대 10초 정도 걸릴 수 있어요.</p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <div className="mb-4 text-2xl">분석 실패</div>
        <p className="text-sm text-destructive">{error ?? '알 수 없는 오류가 발생했습니다'}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => { setError(null); setPhase('questions'); setCurrentIndex(questions.length - 1) }}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
          >
            다시 시도
          </button>
          <button
            type="button"
            onClick={() => router.push(`/clones/${cloneId}`)}
            className="rounded-md border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            나중에 하기
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'preview' && traits) {
    return (
      <TraitsPreview
        traits={traits}
        onConfirm={handleConfirm}
        onRetry={handleRetry}
        confirming={confirming}
      />
    )
  }

  return (
    <>
      <OnboardingCard
        question={currentQ}
        value={currentValue}
        onChange={handleChange}
        onNext={handleNext}
        canNext={currentValue.length > 0}
        current={currentIndex + 1}
        total={questions.length}
      />
      {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}
    </>
  )
}
