import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PersonaSummaryCard } from '@/components/persona/PersonaSummaryCard'
import { ExpandablePersonaDetail } from '@/components/persona/ExpandablePersonaDetail'
import { CloneNpcBadge } from '@/components/clone/CloneNpcBadge'
import { DeleteCloneButton } from '@/components/clone/DeleteCloneButton'
import { NewInteractionHero } from '@/components/interaction/NewInteractionHero'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { MemoryTabs } from '@/components/memory/MemoryTabs'
import { createServiceClient } from '@/lib/supabase/service'
import type { Clone, CloneMemory } from '@/types/persona'
import type { CloneRelationship } from '@/types/relationship'

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

  // 관계 기억 fetch (본인 clone만)
  let relationships: (CloneRelationship & { target_name: string; last_interaction_at: string | null })[] = []
  if (isOwner) {
    const admin = createServiceClient()
    const { data: relRows } = await admin
      .from('clone_relationships')
      .select('*')
      .eq('clone_id', id)
      .order('updated_at', { ascending: false })

    if (relRows && relRows.length > 0) {
      const targetIds = relRows.map((r) => r.target_clone_id)
      const { data: targetClones } = await admin
        .from('clones')
        .select('id, name')
        .in('id', targetIds)
      const nameMap = new Map((targetClones ?? []).map((c) => [c.id, c.name]))

      // 내 clone이 참여한 최신 interaction ended_at 조회
      const { data: myParticipations } = await admin
        .from('interaction_participants')
        .select('interaction_id')
        .eq('clone_id', id)
      const myInteractionIds = (myParticipations ?? []).map((p) => p.interaction_id)

      const lastInteractionMap = new Map<string, string>()
      if (myInteractionIds.length > 0) {
        for (const targetId of targetIds) {
          const { data: shared } = await admin
            .from('interaction_participants')
            .select('interactions!inner(ended_at)')
            .eq('clone_id', targetId)
            .in('interaction_id', myInteractionIds)
            .not('interactions.ended_at', 'is', null)
            .order('interaction_id', { ascending: false })
            .limit(1)
          const endedAt = (shared?.[0] as unknown as { interactions: { ended_at: string } })?.interactions?.ended_at
          if (endedAt) lastInteractionMap.set(targetId, endedAt)
        }
      }

      relationships = (relRows as CloneRelationship[]).map((r) => ({
        ...r,
        target_name: nameMap.get(r.target_clone_id) ?? '알 수 없음',
        last_interaction_at: lastInteractionMap.get(r.target_clone_id) ?? null,
      }))
    }
  }

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

      {/* Inferred Traits 섹션 */}
      {isOwner && !clone.inferred_traits && (
        <Card className="mt-6 border-dashed p-4">
          <p className="text-sm text-muted-foreground">
            성격 파악 퀴즈를 하면 AI가 더 정확하게 대화합니다
          </p>
          <Link href={`/clones/${clone.id}/onboarding`}>
            <Button variant="outline" size="sm" className="mt-2">
              퀴즈 시작
            </Button>
          </Link>
        </Card>
      )}
      {clone.inferred_traits && (
        <Card className="mt-6 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">AI가 파악한 성격</h2>
            {isOwner && (
              <Link
                href={`/clones/${clone.id}/onboarding`}
                className="text-sm text-muted-foreground hover:underline"
              >
                다시 하기
              </Link>
            )}
          </div>
          <div className="space-y-3">
            {[
              { label: '성격', value: clone.inferred_traits.personality_summary },
              { label: '소통 스타일', value: clone.inferred_traits.communication_tendency },
              { label: '사회적 스타일', value: clone.inferred_traits.social_style },
              { label: '가치관', value: clone.inferred_traits.value_priorities.join(', ') },
              { label: '갈등 대처', value: clone.inferred_traits.conflict_style },
              { label: '에너지 패턴', value: clone.inferred_traits.energy_pattern },
              { label: '관심 대화 주제', value: clone.inferred_traits.conversation_topics.join(', ') },
            ].map((r) => (
              <div key={r.label}>
                <span className="text-sm font-medium text-muted-foreground">{r.label}</span>
                <p className="text-sm">{r.value || '-'}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isOwner && (
        <MemoryTabs
          cloneId={clone.id}
          isOwner={isOwner}
          memories={memories}
          relationships={relationships}
        />
      )}
    </main>
  )
}
