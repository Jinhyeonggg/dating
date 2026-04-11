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

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/'
    // 정확 일치 또는 하위 경로 (예: /clones, /clones/123, /clones/new 모두 /clones active)
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div className="flex items-center gap-1">
      {links.map((link) => {
        const active = isActive(link.href)
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
