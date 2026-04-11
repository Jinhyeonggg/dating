import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createInteractionSchema } from '@/lib/validation/interaction'
import { DEFAULT_SCENARIOS, INTERACTION_DEFAULTS } from '@/lib/config/interaction'
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

    // 내가 만든 interaction 목록 (created_by = user.id)
    const { data, error } = await supabase
      .from('interactions')
      .select('*, interaction_participants(clone_id, clones(id, name, is_npc))')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw errors.validation(error.message)
    return NextResponse.json({ interactions: data ?? [] })
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
    const { participantCloneIds, scenarioId, setting, maxTurns, metadata } = parsed.data

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

    const scenario = DEFAULT_SCENARIOS.find((s) => s.id === scenarioId)
    if (!scenario) throw errors.validation(`unknown scenario: ${scenarioId}`)

    const admin = createServiceClient()
    const { data: interaction, error: iErr } = await admin
      .from('interactions')
      .insert({
        kind: 'pair-chat',
        scenario: scenario.label,
        setting: setting ?? null,
        status: 'pending',
        max_turns: maxTurns ?? INTERACTION_DEFAULTS.MAX_TURNS,
        metadata: { scenarioId: scenario.id, ...(metadata ?? {}) },
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
