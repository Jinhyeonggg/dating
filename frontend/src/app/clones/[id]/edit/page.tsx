'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PersonaFullEditor } from '@/components/persona/PersonaFullEditor'
import { Card } from '@/components/ui/card'
import type { Clone, Persona } from '@/types/persona'
import type { PersonaInput } from '@/lib/validation/persona'

export default function CloneEditPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [clone, setClone] = useState<Clone | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/clones/${params.id}`)
        if (!res.ok) throw new Error('로드 실패')
        const body = await res.json()
        setClone(body.clone)
      } catch (e) {
        setError(e instanceof Error ? e.message : '오류')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  async function handleSubmit(persona: PersonaInput) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/clones/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error?.message ?? '저장 실패')
      }
      router.push(`/clones/${params.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      </main>
    )
  }

  if (!clone) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-destructive">Clone을 찾을 수 없습니다.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Clone 상세 편집</h1>
        <p className="text-sm text-muted-foreground">{clone.name}</p>
      </header>
      <Card className="p-6">
        <PersonaFullEditor
          initialPersona={clone.persona_json as Persona}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </Card>
    </main>
  )
}
