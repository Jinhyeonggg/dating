import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createInteractionSchema } from '@/lib/validation/interaction'
import { CONVERSATION_MOODS, INTERACTION_DEFAULTS, getRelationshipStage } from '@/lib/config/interaction'
import { errors, AppError } from '@/lib/errors'
import type { Clone } from '@/types/persona'

function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status }
    )
  }
  console.error('Unhandled error:', err)
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: '서버 오류' } },
    { status: 500 }
  )
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

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
    const { data: started, error: startedError } = await supabase
      .from('interactions')
      .select('*, interaction_participants(clone_id, role, clones(id, name, is_npc))')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (startedError) throw errors.validation(startedError.message)

    // 상대방이 내 clone으로 신청한 interaction
    let received: typeof started = []
    if (myCloneIds.length > 0) {
      const { data: participations } = await admin
        .from('interaction_participants')
        .select('interaction_id')
        .in('clone_id', myCloneIds)

      const participatedIds = (participations ?? []).map((p) => p.interaction_id)
      const startedIds = (started ?? []).map((i) => i.id)
      const receivedIds = participatedIds.filter((id) => !startedIds.includes(id))

      if (receivedIds.length > 0) {
        const { data: receivedData } = await admin
          .from('interactions')
          .select('*, interaction_participants(clone_id, role, clones(id, name, is_npc))')
          .in('id', receivedIds)
          .order('created_at', { ascending: false })

        received = receivedData ?? []
      }
    }

    return NextResponse.json({
      started: started ?? [],
      received: received ?? [],
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const body = await request.json()
    const parsed = createInteractionSchema.safeParse(body)
    if (!parsed.success) {
      throw errors.validation('입력 검증 실패', parsed.error.flatten())
    }
    const { participantCloneIds, moodId, setting, maxTurns, metadata } = parsed.data

    // Clone 2개 fetch + 소유권 검사
    const { data: clones, error: cErr } = await supabase
      .from('clones')
      .select('*')
      .in('id', participantCloneIds)
    if (cErr) throw errors.validation(cErr.message)
    if (!clones || clones.length !== 2) throw errors.notFound('Clone')

    // 참여자 중 최소 1명은 내 Clone이어야 함
    const ownMine = (clones as Clone[]).some(
      (c) => !c.is_npc && c.user_id === user.id
    )
    if (!ownMine) throw errors.forbidden()

    const mood = CONVERSATION_MOODS.find((m) => m.id === moodId)
    if (!mood) throw errors.validation(`unknown mood: ${moodId}`)

    // 관계 단계 조회 (clone_relationships.interaction_count 기반)
    const admin = createServiceClient()
    const [cloneA, cloneB] = participantCloneIds
    const { data: relRows } = await admin
      .from('clone_relationships')
      .select('interaction_count')
      .or(`and(clone_id.eq.${cloneA},target_clone_id.eq.${cloneB}),and(clone_id.eq.${cloneB},target_clone_id.eq.${cloneA})`)
      .limit(1)
    const interactionCount = relRows?.[0]?.interaction_count ?? 0
    const relationshipStage = getRelationshipStage(interactionCount)
    const { data: interaction, error: iErr } = await admin
      .from('interactions')
      .insert({
        kind: 'pair-chat',
        scenario: mood.label,
        setting: setting ?? null,
        status: 'pending',
        max_turns: maxTurns ?? INTERACTION_DEFAULTS.MAX_TURNS,
        metadata: {
          moodId: mood.id,
          relationshipStage: relationshipStage.id,
          ...(metadata ?? {}),
        },
        created_by: user.id,
      })
      .select()
      .single()
    if (iErr || !interaction) throw errors.validation(iErr?.message ?? 'insert failed')

    const { error: pErr } = await admin.from('interaction_participants').insert(
      participantCloneIds.map((id) => ({
        interaction_id: interaction.id,
        clone_id: id,
        role: 'speaker',
      }))
    )
    if (pErr) throw errors.validation(pErr.message)

    return NextResponse.json({ interaction })
  } catch (err) {
    return toErrorResponse(err)
  }
}
