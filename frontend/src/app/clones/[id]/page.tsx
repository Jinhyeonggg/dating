import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PersonaSummaryCard } from '@/components/persona/PersonaSummaryCard'
import { ExpandablePersonaDetail } from '@/components/persona/ExpandablePersonaDetail'
import { CloneNpcBadge } from '@/components/clone/CloneNpcBadge'
import { DeleteCloneButton } from '@/components/clone/DeleteCloneButton'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MemoryInputBox } from '@/components/memory/MemoryInputBox'
import { MemoryTimeline } from '@/components/memory/MemoryTimeline'
import type { Clone, CloneMemory } from '@/types/persona'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CloneDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: clone } = await supabase
    .from('clones')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single<Clone>()

  if (!clone) notFound()

  const isOwner = !clone.is_npc && clone.user_id === user?.id

  const { data: memoriesData } = await supabase
    .from('clone_memories')
    .select('*')
    .eq('clone_id', id)
    .order('occurred_at', { ascending: false })
    .limit(50)
  const memories = (memoriesData ?? []) as CloneMemory[]

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/clones" className="text-sm text-muted-foreground hover:underline">
          ← 목록으로
        </Link>
        <div className="flex items-center gap-2">
          {clone.is_npc && (
            <Link
              href={`/interactions/new?partnerId=${clone.id}`}
              className={buttonVariants({ size: 'sm' })}
            >
              대화 시작
            </Link>
          )}
          {isOwner && (
            <>
              <Link
                href={`/clones/${clone.id}/edit`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                상세 편집
              </Link>
              <DeleteCloneButton cloneId={clone.id} cloneName={clone.name} />
            </>
          )}
        </div>
      </div>

      <Card className="mb-6 p-6">
        {clone.is_npc && (
          <div className="mb-4">
            <CloneNpcBadge />
          </div>
        )}
        <PersonaSummaryCard persona={clone.persona_json} />
      </Card>

      <ExpandablePersonaDetail persona={clone.persona_json} />

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">메모리</h2>
        {isOwner && (
          <div className="mb-4">
            <MemoryInputBox cloneId={clone.id} />
          </div>
        )}
        <MemoryTimeline memories={memories} />
      </section>
    </main>
  )
}
