'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Props {
  cloneId: string
  cloneName: string
}

export function DeleteCloneButton({ cloneId, cloneName }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    const ok = window.confirm(
      `"${cloneName}" Clone을 삭제할까요? 되돌릴 수 없습니다.`
    )
    if (!ok) return

    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/clones/${cloneId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error?.message ?? '삭제 실패')
      }
      router.push('/clones')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={pending}
      >
        {pending ? '삭제 중...' : '삭제'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
