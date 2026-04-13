import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PersonaSummaryCard } from '@/components/persona/PersonaSummaryCard'
import { ExpandablePersonaDetail } from '@/components/persona/ExpandablePersonaDetail'
import { DeleteCloneButton } from '@/components/clone/DeleteCloneButton'
import { MyCloneSelector } from '@/components/clone/MyCloneSelector'
import { MemoryTabs } from '@/components/memory/MemoryTabs'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { createServiceClient } from '@/lib/supabase/service'
import type { Clone, CloneMemory } from '@/types/persona'
import type { CloneRelationship } from '@/types/relationship'

interface PageProps {
  searchParams: Promise<{ selected?: string }>
}

export default async function MyClonesPage({ searchParams }: PageProps) {
  const { selected } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: minesData } = await supabase
    .from('clones')
    .select('*')
    .eq('is_npc', false)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const mines = (minesData ?? []) as Clone[]

  if (mines.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">내 Clone</h1>
        </header>
        <Card className="p-8 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            아직 만든 Clone이 없어요.
          </p>
          <Link
            href="/clones/new"
            className={buttonVariants({ size: 'sm' })}
          >
            + 새 Clone 만들기
          </Link>
        </Card>
      </main>
    )
  }

  const selectedId = mines.some((c) => c.id === selected)
    ? (selected as string)
    : mines[0].id
  const clone = mines.find((c) => c.id === selectedId)!

  const { data: memoriesData } = await supabase
    .from('clone_memories')
    .select('*')
    .eq('clone_id', clone.id)
    .order('occurred_at', { ascending: false })
    .limit(50)
  const memories = (memoriesData ?? []) as CloneMemory[]

  // 관계 기억 fetch
  const admin = createServiceClient()
  const { data: relRows } = await admin
    .from('clone_relationships')
    .select('*')
    .eq('clone_id', clone.id)
    .order('updated_at', { ascending: false })

  let relationships: (CloneRelationship & { target_name: string })[] = []
  if (relRows && relRows.length > 0) {
    const targetIds = relRows.map((r) => r.target_clone_id)
    const { data: targetClones } = await admin
      .from('clones')
      .select('id, name')
      .in('id', targetIds)
    const nameMap = new Map((targetClones ?? []).map((c) => [c.id, c.name]))
    relationships = (relRows as CloneRelationship[]).map((r) => ({
      ...r,
      target_name: nameMap.get(r.target_clone_id) ?? '알 수 없음',
    }))
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">내 Clone</h1>
        <Link
          href="/clones/new"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          + 새 Clone
        </Link>
      </header>

      <section className="mb-6">
        <MyCloneSelector clones={mines} selectedId={selectedId} />
      </section>

      <div className="mb-4 flex items-center justify-end gap-2">
        <Link
          href={`/clones/${clone.id}/edit`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          상세 편집
        </Link>
        <DeleteCloneButton cloneId={clone.id} cloneName={clone.name} />
      </div>

      <Card className="mb-6 p-6">
        <PersonaSummaryCard persona={clone.persona_json} />
      </Card>

      <ExpandablePersonaDetail persona={clone.persona_json} />

      <MemoryTabs
        cloneId={clone.id}
        isOwner={true}
        memories={memories}
        relationships={relationships}
      />
    </main>
  )
}
