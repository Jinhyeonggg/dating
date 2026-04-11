import { createClient } from '@/lib/supabase/server'
import { CloneList } from '@/components/clone/CloneList'
import type { Clone } from '@/types/persona'

export default async function ClonesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [mineResult, npcsResult] = await Promise.all([
    supabase
      .from('clones')
      .select('*')
      .eq('is_npc', false)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('clones')
      .select('*')
      .eq('is_npc', true)
      .is('deleted_at', null)
      .order('name'),
  ])

  const mine = (mineResult.data ?? []) as Clone[]
  const npcs = (npcsResult.data ?? []) as Clone[]

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Clones</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </header>
      <CloneList mine={mine} npcs={npcs} />
    </main>
  )
}
