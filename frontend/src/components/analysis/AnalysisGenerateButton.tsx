'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Props {
  interactionId: string
}

export function AnalysisGenerateButton({ interactionId }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionId }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error ?? '분석 생성에 실패했습니다.')
      }
      const id = data?.analysis?.id ?? data?.id
      if (!id) throw new Error('분석 ID를 받지 못했습니다.')
      router.push(`/analyses/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류')
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleClick} disabled={pending}>
        {pending ? '분석 중... (약 10-20초)' : '분석 보기'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
