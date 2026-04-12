'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PersonaQuickForm } from '@/components/persona/PersonaQuickForm'
import { Card } from '@/components/ui/card'
import type { PersonaInput } from '@/lib/validation/persona'

export default function NewClonePage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(persona: PersonaInput) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/clones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error?.message ?? 'Clone 생성 실패')
      }
      const { clone } = await res.json()
      router.push(`/clones/${clone.id}/onboarding`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">새 Clone 만들기</h1>
        <p className="text-sm text-muted-foreground">
          핵심 필드만 입력해 빠르게 만들고, 나중에 상세 편집에서 보강할 수 있습니다.
        </p>
      </header>
      <Card className="p-6">
        <PersonaQuickForm onSubmit={handleSubmit} submitting={submitting} />
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </Card>
    </main>
  )
}
