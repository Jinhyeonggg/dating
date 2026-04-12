import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PersonaSummaryCard } from '@/components/persona/PersonaSummaryCard'
import { ExpandablePersonaDetail } from '@/components/persona/ExpandablePersonaDetail'
import { CloneNpcBadge } from '@/components/clone/CloneNpcBadge'
import { DeleteCloneButton } from '@/components/clone/DeleteCloneButton'
import { NewInteractionHero } from '@/components/interaction/NewInteractionHero'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
        {isOwner && (
          <div className="flex items-center gap-2">
            <Link
              href={`/clones/${clone.id}/edit`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              상세 편집
            </Link>
            <DeleteCloneButton cloneId={clone.id} cloneName={clone.name} />
          </div>
        )}
      </div>

      <Card className="mb-6 p-6">
        {(clone.is_npc || (!isOwner && !clone.is_npc)) && (
          <div className="mb-4">
            {clone.is_npc ? (
              <CloneNpcBadge />
            ) : (
              <Badge variant="outline" className="text-xs">
                커뮤니티
              </Badge>
            )}
          </div>
        )}
        <PersonaSummaryCard persona={clone.persona_json} />
      </Card>

      {!isOwner && (
        <div className="mb-6">
          <NewInteractionHero partnerId={clone.id} />
        </div>
      )}

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
