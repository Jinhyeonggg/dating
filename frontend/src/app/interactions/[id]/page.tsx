import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InteractionViewer } from '@/components/interaction/InteractionViewer'
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/interactions"
        className="mb-4 inline-block text-sm text-muted-foreground hover:underline"
      >
        ← Interactions 목록
      </Link>
      <InteractionViewer
        interaction={interaction}
        initialEvents={(events ?? []) as InteractionEvent[]}
        participants={participants}
      />
    </main>
  )
}
