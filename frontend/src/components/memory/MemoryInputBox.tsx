'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  cloneId: string
}

export function MemoryInputBox({ cloneId }: Props) {
  const router = useRouter()
  const [raw, setRaw] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!raw.trim()) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloneId, rawText: raw.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message ?? '추가 실패')
      setRaw('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="예: 오늘 영화 봤어. 해리포터 다시 봤는데 여전히 좋아."
        rows={3}
        className="resize-none"
        disabled={pending}
      />
      <div className="flex items-center justify-between">
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="ml-auto">
          <Button type="submit" size="sm" disabled={pending || !raw.trim()}>
            {pending ? '추출 중...' : '메모리 추가'}
          </Button>
        </div>
      </div>
    </form>
  )
}
