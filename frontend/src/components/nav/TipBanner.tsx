'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Tip {
  text: string
  href: string
  linkLabel: string
}

const TIPS: Tip[] = [
  {
    text: '다른 사람의 클론과 대화해 보세요 — 상대를 골라 대화를 시작할 수 있어요',
    href: '/clones',
    linkLabel: 'Clones 보기',
  },
  {
    text: '클론에게 근황을 알려주면 대화가 더 자연스러워져요 — 메모리를 업데이트해 보세요',
    href: '/clones/mine',
    linkLabel: '내 Clone',
  },
  {
    text: '클론의 성격이나 관심사가 바뀌었나요? 상세 정보를 수정할 수 있어요',
    href: '/clones/mine',
    linkLabel: '수정하기',
  },
]

const TIP_DISMISSED_KEY = 'clone_tip_dismissed'

export function TipBanner() {
  const [tip, setTip] = useState<Tip | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // 세션 내 이미 dismiss 했으면 안 보여줌
    if (sessionStorage.getItem(TIP_DISMISSED_KEY) === 'true') return

    const picked = TIPS[Math.floor(Math.random() * TIPS.length)]
    setTip(picked)
    setVisible(true)
  }, [])

  function dismiss() {
    setVisible(false)
    sessionStorage.setItem(TIP_DISMISSED_KEY, 'true')
  }

  if (!visible || !tip) return null

  return (
    <div className="border-b border-amber-200/60 bg-gradient-to-r from-amber-50/80 to-yellow-50/80 dark:from-amber-950/20 dark:to-yellow-950/20">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg dark:bg-amber-900/40">
            💡
          </span>
          <p className="min-w-0 truncate text-sm text-foreground/80">
            {tip.text}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={tip.href}
            onClick={dismiss}
            className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
          >
            {tip.linkLabel}
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
            aria-label="닫기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
