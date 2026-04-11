import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InteractionViewer } from '@/components/interaction/InteractionViewer'
import { DeleteInteractionButton } from '@/components/interaction/DeleteInteractionButton'
import type { Clone } from '@/types/persona'
import type { Interaction, InteractionEvent } from '@/types/interaction'

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

  const { data: interaction } = await supabase
    .from('interactions')
    .select('*')
    .eq('id', id)
    .maybeSingle<Interaction>()
  if (!interaction) notFound()

  const { data: participantRows } = await supabase
    .from('interaction_participants')
    .select('clone_id, clones(*)')
    .eq('interaction_id', id)

  const participants =
    (participantRows as unknown as ParticipantRow[] | null)?.map(
      (r) => r.clones
    ) ?? []
  if (participants.length !== 2) notFound()

  const { data: events } = await supabase
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
    </main>
  )
}
