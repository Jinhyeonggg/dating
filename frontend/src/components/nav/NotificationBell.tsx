'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface UnreadItem {
  interaction_id: string
  status: string
  scenario: string
  created_at: string
  names: string
}

export function NotificationBell() {
  const router = useRouter()
  const [unread, setUnread] = useState<UnreadItem[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const body = await res.json()
      setUnread(body.unread ?? [])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleMarkSeen(interactionId: string) {
    setOpen(false)
    try {
      await fetch(`/api/interactions/${interactionId}/seen`, { method: 'POST' })
      setUnread((prev) => prev.filter((item) => item.interaction_id !== interactionId))
    } catch {
      // silent
    }
    router.push(`/interactions/${interactionId}`)
  }

  const count = unread.length

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label={`알림 ${count}개`}
      >
        {/* Bell SVG */}
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {/* 빨간 뱃지 */}
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* 드롭다운 */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-background shadow-lg">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">
              {count > 0 ? `읽지 않은 알림 ${count}개` : '새 알림 없음'}
            </p>
          </div>

          {count === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              모든 알림을 확인했습니다
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {unread.map((item) => (
                <button
                  key={item.interaction_id}
                  type="button"
                  onClick={() => handleMarkSeen(item.interaction_id)}
                  className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition last:border-b-0 hover:bg-muted/50"
                >
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.names}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.scenario} · {new Date(item.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {count > 0 && (
            <div className="border-t px-4 py-2">
              <Link
                href="/interactions"
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground hover:underline"
              >
                전체 보기
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
