'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface NavLink {
  href: string
  label: string
}

interface Props {
  links: NavLink[]
}

export function NavLinks({ links }: Props) {
  const pathname = usePathname()

  // 가장 "구체적인" (prefix가 가장 긴) 매칭 링크 하나만 활성화.
  // 예: /clones/abc123 → "/clones"도 "/clones/abc123"도 prefix-match 되지만
  // 후자가 더 길어서 "내 Clone" 만 active, "Clones"는 비활성.
  function matchLength(href: string): number {
    if (href === '/') return pathname === '/' ? 1 : -1
    if (pathname === href) return href.length
    if (pathname.startsWith(`${href}/`)) return href.length
    return -1
  }

  let bestIdx = -1
  let bestLen = -1
  links.forEach((l, i) => {
    const len = matchLength(l.href)
    if (len > bestLen) {
      bestLen = len
      bestIdx = i
    }
  })

  return (
    <div className="flex items-center gap-1">
      {links.map((link, i) => {
        const active = i === bestIdx
        return (
          <Link
            key={link.label}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'relative text-sm',
              active && 'bg-muted font-semibold text-foreground'
            )}
          >
            {link.label}
            {active && (
              <span className="absolute inset-x-2 -bottom-[13px] h-[2px] rounded-full bg-primary" />
            )}
          </Link>
        )
      })}
    </div>
  )
}
