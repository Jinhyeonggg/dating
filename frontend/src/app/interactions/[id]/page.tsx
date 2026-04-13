import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { InteractionViewer } from '@/components/interaction/InteractionViewer'
import { RelationshipExtractTrigger } from '@/components/interaction/RelationshipExtractTrigger'
import { DeleteInteractionButton } from '@/components/interaction/DeleteInteractionButton'
import type { Clone } from '@/types/persona'
import type { Interaction, InteractionEvent } from '@/types/interaction'

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean)

interface PageProps {
  params: Promise<{ id: string }>
}

interface ParticipantRow {
  clone_id: string
  clones: Clone
}

export default async function InteractionViewerPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Admin이면 RLS 우회해서 모든 interaction 조회 가능
  const isAdmin = user && ADMIN_IDS.includes(user.id)
  const db = isAdmin ? createServiceClient() : supabase

  const { data: interaction } = await db
    .from('interactions')
    .select('*')
    .eq('id', id)
    .maybeSingle<Interaction>()
  if (!interaction) notFound()

  const { data: participantRows } = await db
    .from('interaction_participants')
    .select('clone_id, clones(*)')
    .eq('interaction_id', id)

  const participants =
    (participantRows as unknown as ParticipantRow[] | null)?.map(
      (r) => r.clones
    ) ?? []
  if (participants.length !== 2) notFound()

  // 내 Clone을 오른쪽(index 1)으로 정렬 — 메시징 앱 관례
  const isMine = (c: Clone) => !c.is_npc && c.user_id === user?.id
  participants.sort((a, b) => {
    const aMine = isMine(a) ? 1 : 0
    const bMine = isMine(b) ? 1 : 0
    return aMine - bMine
  })

  const { data: events } = await db
    .from('interaction_events')
    .select('*')
    .eq('interaction_id', id)
    .order('turn_number', { ascending: true })

  const pairLabel = participants.map((p) => p.name).join(' × ')

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/interactions"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Interactions 목록
        </Link>
        <DeleteInteractionButton
          interactionId={interaction.id}
          label={pairLabel}
        />
      </div>
      <InteractionViewer
        interaction={interaction}
        initialEvents={(events ?? []) as InteractionEvent[]}
        participants={participants}
      />
      <RelationshipExtractTrigger
        interactionId={interaction.id}
        status={interaction.status}
      />
    </main>
  )
}
