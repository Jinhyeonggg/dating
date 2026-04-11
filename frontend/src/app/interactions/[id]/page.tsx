import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { InteractionViewer } from '@/components/interaction/InteractionViewer'
import { Card } from '@/components/ui/card'
import type { Clone } from '@/types/persona'
import type { Interaction, InteractionEvent } from '@/types/interaction'

interface PageProps {
  params: Promise<{ id: string }>
}

interface ParticipantRow {
  clone_id: string
  clones: Clone
}

function DiagnosticPage({ title, details }: { title: string; details: string }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/interactions"
        className="mb-4 inline-block text-sm text-muted-foreground hover:underline"
      >
        ← Interactions 목록
      </Link>
      <Card className="p-6">
        <h1 className="mb-2 text-lg font-semibold">{title}</h1>
        <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
          {details}
        </pre>
      </Card>
    </main>
  )
}

export default async function InteractionViewerPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const interactionRes = await supabase
    .from('interactions')
    .select('*')
    .eq('id', id)
    .maybeSingle<Interaction>()

  if (!interactionRes.data) {
    return (
      <DiagnosticPage
        title="Interaction을 찾을 수 없습니다"
        details={JSON.stringify(
          {
            id,
            user: user?.id ?? null,
            error: interactionRes.error ?? null,
          },
          null,
          2
        )}
      />
    )
  }
  const interaction = interactionRes.data

  const participantRes = await supabase
    .from('interaction_participants')
    .select('clone_id, clones(*)')
    .eq('interaction_id', id)

  const participants =
    (participantRes.data as unknown as ParticipantRow[] | null)?.map(
      (r) => r.clones
    ) ?? []
  if (participants.length !== 2) {
    return (
      <DiagnosticPage
        title="참여자 정보가 불완전합니다"
        details={JSON.stringify(
          {
            id,
            interactionCreatedBy: interaction.created_by,
            user: user?.id ?? null,
            participantRowsCount: participantRes.data?.length ?? 0,
            resolvedParticipants: participants.length,
            error: participantRes.error ?? null,
            raw: participantRes.data,
          },
          null,
          2
        )}
      />
    )
  }

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
