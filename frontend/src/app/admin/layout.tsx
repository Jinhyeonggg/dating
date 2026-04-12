import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean)

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  console.log('[admin] user:', user?.id, 'ADMIN_IDS:', ADMIN_IDS, 'match:', user ? ADMIN_IDS.includes(user.id) : false)
  if (!user || !ADMIN_IDS.includes(user.id)) redirect('/clones')
  return <>{children}</>
}
