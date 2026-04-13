import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getRuntimeConfig } from '@/lib/config/runtime'
import { extractRelationshipMemories } from '@/lib/relationship/service'
import { errors, AppError } from '@/lib/errors'
import type { Clone } from '@/types/persona'
import type { InteractionEvent } from '@/types/interaction'

function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status }
    )
  }
  console.error('Unhandled error:', err)
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: '서버 오류' } },
    { status: 500 }
  )
}

export const maxDuration = 60

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const runtimeConfig = await getRuntimeConfig()
    if (!runtimeConfig.relationshipMemoryEnabled) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const { id } = await ctx.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const admin = createServiceClient()

    // interaction 상태 확인
    const { data: interaction } = await admin
      .from('interactions')
      .select('id, status')
      .eq('id', id)
      .single()
    if (!interaction) throw errors.notFound('Interaction')
    if (interaction.status !== 'completed') {
      return NextResponse.json({ ok: true, skipped: true, reason: 'not_completed' })
    }

    // participants 조회
    const { data: participantRows } = await admin
      .from('interaction_participants')
      .select('clone_id, clones(*)')
      .eq('interaction_id', id)
    const clones = (participantRows ?? [])
      .map((r) => (r as unknown as { clones: Clone }).clones)
      .filter(Boolean)
    if (clones.length !== 2) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'not_2_participants' })
    }

    // 양방향 모두 추출되었는지 확인 (한쪽만 되었으면 재실행)
    const [a, b] = clones
    const { data: existingRels } = await admin
      .from('clone_relationships')
      .select('clone_id, target_clone_id, interaction_count')
      .or(`and(clone_id.eq.${a.id},target_clone_id.eq.${b.id}),and(clone_id.eq.${b.id},target_clone_id.eq.${a.id})`)
    const extractedCount = (existingRels ?? []).filter((r) => r.interaction_count > 0).length
    if (extractedCount >= 2) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'already_extracted' })
    }

    // events 조회
    const { data: events } = await admin
      .from('interaction_events')
      .select('*')
      .eq('interaction_id', id)
      .order('turn_number', { ascending: true })
    if (!events || events.length === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_events' })
    }

    // 추출 실행
    await extractRelationshipMemories(
      events as InteractionEvent[],
      clones.map((c) => ({ id: c.id, name: c.name, persona_json: c.persona_json })),
      id,
    )

    return NextResponse.json({ ok: true, extracted: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
