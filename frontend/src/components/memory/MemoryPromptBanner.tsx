'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'

const LAST_VISIT_KEY = 'clone_last_visit'
const PROMPT_DISMISSED_KEY = 'clone_memory_prompt_dismissed'
const ONE_HOUR_MS = 60 * 60 * 1000

interface CloneInfo {
  id: string
  name: string
}

export function MemoryPromptBanner() {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [clones, setClones] = useState<CloneInfo[]>([])
  const [selectedCloneId, setSelectedCloneId] = useState<string | null>(null)
  const [raw, setRaw] = useState('')
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const now = Date.now()
    const lastVisit = parseInt(localStorage.getItem(LAST_VISIT_KEY) ?? '0', 10)
    const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY)

    // 항상 마지막 접속 시각 갱신
    localStorage.setItem(LAST_VISIT_KEY, String(now))

    // 1시간 이상 경과 + 이번 세션에서 아직 dismiss 안 함
    if (lastVisit > 0 && now - lastVisit > ONE_HOUR_MS && dismissed !== 'true') {
      // 내 clone 목록 가져오기
      fetch('/api/clones')
        .then((r) => r.json())
        .then((data) => {
          const mine: CloneInfo[] = (data.mine ?? []).map((c: { id: string; name: string }) => ({
            id: c.id,
            name: c.name,
          }))
          if (mine.length > 0) {
            setClones(mine)
            setSelectedCloneId(mine[0].id)
            setShow(true)
          }
        })
        .catch(() => {})
    }
  }, [])

  const dismiss = useCallback(() => {
    setShow(false)
    localStorage.setItem(PROMPT_DISMISSED_KEY, 'true')
    // 다음 페이지 전환 시 다시 체크할 수 있도록 sessionStorage 대신 제거 타이머
    // → 실제로는 이번 탭 세션에서만 dismiss. 새 탭/새 접속 시 다시 뜰 수 있음
  }, [])

  // 탭이 닫히거나 새로고침 시 dismiss 상태 초기화
  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.removeItem(PROMPT_DISMISSED_KEY)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!raw.trim() || !selectedCloneId) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloneId: selectedCloneId, rawText: raw.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message ?? '추가 실패')
      setRaw('')
      setSuccess(true)
      setTimeout(() => {
        dismiss()
        router.refresh()
      }, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPending(false)
    }
  }

  if (!show) return null

  return (
    <div className="border-b bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-3">
        {!expanded ? (
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-left text-sm text-foreground hover:underline"
            >
              <span className="mr-2">💭</span>
              다시 오셨군요! 그동안 어떻게 지내셨어요? 클론에게 근황을 알려주세요
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
            >
              닫기
            </button>
          </div>
        ) : success ? (
          <div className="py-2 text-center text-sm text-green-600">
            메모리가 업데이트됐어요!
          </div>
        ) : (
          <Card className="p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                최근 있었던 일, 기분, 새로 알게 된 것 등 뭐든 자유롭게 적어보세요.
                클론이 다음 대화에서 기억해요.
              </p>

              {clones.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">클론:</span>
                  <div className="flex gap-1">
                    {clones.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCloneId(c.id)}
                        className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                          selectedCloneId === c.id
                            ? 'border-primary bg-primary/10 font-medium'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="예: 어제 친구랑 새로 오픈한 이탈리안 레스토랑 갔는데 정말 맛있었어"
                rows={2}
                className="resize-none"
                disabled={pending}
                autoFocus
              />

              <div className="flex items-center justify-between">
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="ml-auto flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={dismiss}
                    disabled={pending}
                  >
                    나중에
                  </Button>
                  <Button type="submit" size="sm" disabled={pending || !raw.trim()}>
                    {pending ? '저장 중...' : '메모리 업데이트'}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}
