'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InteractionPairPicker } from '@/components/interaction/InteractionPairPicker'
import { ScenarioPicker } from '@/components/interaction/ScenarioPicker'
import { DEFAULT_SCENARIOS } from '@/lib/config/interaction'
import type { Clone } from '@/types/persona'

export default function NewInteractionPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-4 py-8">
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        </main>
      }
    >
      <NewInteractionContent />
    </Suspense>
  )
}

function NewInteractionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const partnerIdFromQuery = searchParams.get('partnerId')
  const [mine, setMine] = useState<Clone[]>([])
  const [npcs, setNpcs] = useState<Clone[]>([])
  const [pair, setPair] = useState<[string | null, string | null]>([null, null])
  const [scenarioId, setScenarioId] = useState<string>(DEFAULT_SCENARIOS[0].id)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/clones')
      .then((r) => r.json())
      .then((data) => {
        const mineList: Clone[] = data.mine ?? []
        const npcList: Clone[] = data.npcs ?? []
        setMine(mineList)
        setNpcs(npcList)

        const validPartner =
          partnerIdFromQuery &&
          [...mineList, ...npcList].some((c) => c.id === partnerIdFromQuery)
            ? partnerIdFromQuery
            : null
        setPair([
          mineList.length === 1 ? mineList[0].id : null,
          validPartner,
        ])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [partnerIdFromQuery])

  async function handleStart() {
    if (!pair[0] || !pair[1]) {
      setError('두 Clone을 선택해주세요.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantCloneIds: pair,
          scenarioId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const detail = data?.error?.details
          ? ` (${JSON.stringify(data.error.details)})`
          : ''
        throw new Error((data?.error?.message ?? '생성 실패') + detail)
      }
      router.push(`/interactions/${data.interaction.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Clone 불러오는 중...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">새 Interaction</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          두 Clone을 선택하고 시나리오를 고르면 대화가 시작됩니다.
        </p>
      </header>

      <div className="space-y-6">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">참여자</h2>
          <InteractionPairPicker
            mine={mine}
            npcs={npcs}
            selected={pair}
            onChange={setPair}
          />
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">시나리오</h2>
          <ScenarioPicker value={scenarioId} onChange={setScenarioId} />
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end">
          <Button onClick={handleStart} disabled={submitting}>
            {submitting ? '시작 중...' : '대화 시작'}
          </Button>
        </div>
      </div>
    </main>
  )
}
