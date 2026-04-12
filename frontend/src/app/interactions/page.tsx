import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Card } from '@/components/ui/card'
import { InteractionStatusBadge } from '@/components/interaction/InteractionStatusBadge'
import { NewInteractionHero } from '@/components/interaction/NewInteractionHero'
import type { Interaction } from '@/types/interaction'
import type { Clone } from '@/types/persona'

interface InteractionRow extends Interaction {
  interaction_participants: Array<{
    clone_id: string
    clones: Pick<Clone, 'id' | 'name' | 'is_npc'>
  }>
}

const DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function InteractionList({ interactions, emptyMessage }: { interactions: InteractionRow[]; emptyMessage: string }) {
  if (interactions.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    )
  }

  return (
    <div className="space-y-2">
      {interactions.map((i) => {
        const names = i.interaction_participants
          .map((p) => p.clones?.name ?? '?')
          .join(' × ')
        const when = DATE_FORMATTER.format(new Date(i.created_at))
        const turns =
          typeof (i.metadata as Record<string, unknown>)?.turnsCompleted ===
          'number'
            ? `${(i.metadata as { turnsCompleted: number }).turnsCompleted}턴`
            : null
        return (
          <Link key={i.id} href={`/interactions/${i.id}`} className="block">
            <Card className="flex items-center justify-between gap-3 p-4 transition hover:bg-muted/50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{names}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    · {when}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {i.scenario}
                  {turns && <span className="ml-2">· {turns}</span>}
                </p>
              </div>
              <InteractionStatusBadge status={i.status} />
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

export default async function InteractionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-muted-foreground">로그인이 필요합니다.</p>
      </main>
    )
  }

  const admin = createServiceClient()

  // 내 clone ID 목록
  const { data: myClones } = await supabase
    .from('clones')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_npc', false)
    .is('deleted_at', null)
  const myCloneIds = (myClones ?? []).map((c) => c.id)

  // 내가 시작한 interaction
  const { data: startedData } = await supabase
    .from('interactions')
    .select('*, interaction_participants(clone_id, clones(id, name, is_npc))')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const started = (startedData ?? []) as unknown as InteractionRow[]

  // 상대방이 내 clone으로 신청한 interaction
  let received: InteractionRow[] = []
  if (myCloneIds.length > 0) {
    const { data: participations } = await admin
      .from('interaction_participants')
      .select('interaction_id')
      .in('clone_id', myCloneIds)

    const participatedIds = (participations ?? []).map((p) => p.interaction_id)
    const startedIds = started.map((i) => i.id)
    const receivedIds = participatedIds.filter((id: string) => !startedIds.includes(id))

    if (receivedIds.length > 0) {
      const { data: receivedData } = await admin
        .from('interactions')
        .select('*, interaction_participants(clone_id, clones(id, name, is_npc))')
        .in('id', receivedIds)
        .order('created_at', { ascending: false })

      received = (receivedData ?? []) as unknown as InteractionRow[]
    }
  }

  const hasAny = started.length > 0 || received.length > 0

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Interactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clone 간 대화 기록을 확인하고 새로 시작하세요.
        </p>
      </header>

      <div className="mb-6">
        <NewInteractionHero />
      </div>

      {!hasAny ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          아직 기록이 없어요. 위에서 새 대화를 시작해보세요.
        </Card>
      ) : (
        <div className="space-y-8">
          {received.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">받은 대화 요청</h2>
              <InteractionList interactions={received} emptyMessage="" />
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold">내가 시작한 대화</h2>
            <InteractionList interactions={started} emptyMessage="아직 시작한 대화가 없습니다" />
          </section>
        </div>
      )}
    </main>
  )
}
