import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from './LogoutButton'
import { BackButton } from './BackButton'
import { NavLinks, type NavLink } from './NavLinks'

export async function AppNav() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // 내 Clone 바로가기 — 1개 이상 있으면 /clones/mine (선택형 뷰) 로
  const { data: myClones } = await supabase
    .from('clones')
    .select('id')
    .eq('is_npc', false)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .limit(1)

  const hasMyClone = (myClones?.length ?? 0) > 0

  const navLinks: NavLink[] = [
    { href: '/clones', label: 'Clones' },
    { href: '/interactions', label: 'Interactions' },
  ]
  if (hasMyClone) {
    navLinks.push({ href: '/clones/mine', label: '내 Clone' })
  }

  return (
    <nav className="border-b bg-background">
      <div className="relative mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* 뒤로가기 — flex 레이아웃 밖, 좌측 거터에 absolute 배치 (mobile에선 숨김) */}
        <div className="absolute top-1/2 left-2 hidden -translate-x-full -translate-y-1/2 md:block">
          <BackButton />
        </div>
        <div className="flex items-center gap-6">
          <Link href="/clones" className="text-lg font-semibold">
            Digital Clone
          </Link>
          <NavLinks links={navLinks} />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {user.email}
          </span>
          <LogoutButton />
        </div>
      </div>
    </nav>
  )
}
