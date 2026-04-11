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

  // 내 Clone 바로가기 — 정확히 1개면 상세 페이지로, 아니면 /clones 로
  const { data: myClones } = await supabase
    .from('clones')
    .select('id')
    .eq('is_npc', false)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(2)

  const myClonesCount = myClones?.length ?? 0

  const navLinks: NavLink[] = [
    { href: '/clones', label: 'Clones' },
    { href: '/interactions', label: 'Interactions' },
  ]
  // 클론이 정확히 1개일 때만 바로가기 노출 (목록은 "Clones" 가 이미 담당)
  if (myClonesCount === 1 && myClones) {
    navLinks.push({
      href: `/clones/${myClones[0].id}`,
      label: '내 Clone',
    })
  }

  return (
    <nav className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <BackButton />
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
