import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { InteractionStatusBadge } from '@/components/interaction/InteractionStatusBadge'
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

export default async function InteractionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('interactions')
    .select('*, interaction_participants(clone_id, clones(id, name, is_npc))')
    .eq('created_by', user?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(50)

  const interactions = (data ?? []) as unknown as InteractionRow[]

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Interactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clone 간 대화 기록을 확인하고 새로 시작하세요.
          </p>
        </div>
        <Link href="/interactions/new" className={buttonVariants({ size: 'sm' })}>
          + 새 Interaction
        </Link>
      </header>

      {interactions.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          아직 기록이 없어요. 새 Interaction을 시작해보세요.
        </Card>
      ) : (
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
      )}
    </main>
  )
}
