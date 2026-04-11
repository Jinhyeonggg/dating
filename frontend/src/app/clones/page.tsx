import { createClient } from '@/lib/supabase/server'
import { CloneList } from '@/components/clone/CloneList'
import type { Clone } from '@/types/persona'

export default async function ClonesPage() {
  const supabase = await createClient()

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
        <p className="mt-1 text-sm text-muted-foreground">
          내 Clone과 NPC들을 둘러보고, 새 Clone을 만들어보세요.
        </p>
      </header>
      <CloneList mine={mine} npcs={npcs} />
    </main>
  )
}
