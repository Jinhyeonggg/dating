import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'
import Link from 'next/link'

export default async function OnboardingPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">성격 파악 퀴즈</h1>
          <p className="text-sm text-muted-foreground">
            간단한 질문에 답하면 AI가 성격 패턴을 분석합니다 (2-3분)
          </p>
        </div>
        <Link
          href={`/clones/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          나중에 하기
        </Link>
      </header>
      <OnboardingFlow cloneId={id} />
    </main>
  )
}
