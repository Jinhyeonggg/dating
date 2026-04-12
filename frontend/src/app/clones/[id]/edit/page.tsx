'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PersonaFullEditor } from '@/components/persona/PersonaFullEditor'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { PERSONA_SECTIONS } from '@/lib/constants/personaFields'
import type { Clone, Persona } from '@/types/persona'
import type { PersonaInput } from '@/lib/validation/persona'

// Flat list of all field keys across all sections
const ALL_FIELD_KEYS = PERSONA_SECTIONS.flatMap((s) => s.fields.map((f) => f.key as string))

export default function CloneEditPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [clone, setClone] = useState<Clone | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isPublic, setIsPublic] = useState(false)
  const [publicFields, setPublicFields] = useState<string[]>([])
  const [privacyUpdating, setPrivacyUpdating] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/clones/${params.id}`)
        if (!res.ok) throw new Error('로드 실패')
        const body = await res.json()
        const loaded: Clone = body.clone
        setClone(loaded)
        setIsPublic(loaded.is_public ?? false)
        setPublicFields(loaded.public_fields ?? ALL_FIELD_KEYS)
      } catch (e) {
        setError(e instanceof Error ? e.message : '오류')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  async function patchPrivacy(patch: { is_public?: boolean; public_fields?: string[] }) {
    setPrivacyUpdating(true)
    try {
      const res = await fetch(`/api/clones/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error?.message ?? '저장 실패')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류')
    } finally {
      setPrivacyUpdating(false)
    }
  }

  async function handlePublicToggle(value: boolean) {
    setIsPublic(value)
    await patchPrivacy({ is_public: value })
  }

  async function handleLockToggle(fieldKey: string) {
    const next = publicFields.includes(fieldKey)
      ? publicFields.filter((k) => k !== fieldKey)
      : [...publicFields, fieldKey]
    setPublicFields(next)
    await patchPrivacy({ public_fields: next })
  }

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

      {/* is_public toggle */}
      <div className="mb-6 flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="font-medium">다른 유저에게 공개</p>
          <p className="text-sm text-muted-foreground">커뮤니티에서 이 Clone을 볼 수 있습니다</p>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={handlePublicToggle}
          disabled={privacyUpdating}
        />
      </div>

      <Card className="p-6">
        <PersonaFullEditor
          initialPersona={clone.persona_json as Persona}
          onSubmit={handleSubmit}
          submitting={submitting}
          publicFields={publicFields}
          onTogglePublic={isPublic ? handleLockToggle : undefined}
          showPublicToggle={isPublic}
        />
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </Card>
    </main>
  )
}
