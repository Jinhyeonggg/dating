import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runInteraction } from '@/lib/interaction/engine'
import { prepareClonePrompts } from '@/lib/interaction/orchestrate'
import { DEFAULT_SCENARIOS, FEATURE_FLAGS } from '@/lib/config/interaction'
import { extractRelationshipMemories } from '@/lib/relationship/service'
import { errors, AppError } from '@/lib/errors'
import type { Clone, CloneMemory } from '@/types/persona'
import type { InteractionEvent } from '@/types/interaction'

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

export const maxDuration = 300 // Vercel Fluid Compute, 기본값이 이미 300이나 명시

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    // interaction + participants fetch + 소유권 검증
    const { data: interaction, error: iErr } = await supabase
      .from('interactions')
      .select('*')
      .eq('id', id)
      .single()
    if (iErr || !interaction) throw errors.notFound('Interaction')
    if (interaction.created_by !== user.id) throw errors.forbidden()

    // 이미 completed/failed/cancelled 인 경우 중복 실행 방지
    if (['completed', 'failed', 'cancelled'].includes(interaction.status)) {
      return NextResponse.json({ ok: true, status: interaction.status })
    }

    // stuck된 running 상태 (10분 이상 경과): 재실행 허용
    if (interaction.status === 'running') {
      const startedAt = interaction.started_at ? new Date(interaction.started_at).getTime() : 0
      const elapsed = Date.now() - startedAt
      if (elapsed < 10 * 60 * 1000) {
        // 10분 미만이면 아직 실행 중일 수 있으므로 중복 방지
        return NextResponse.json({ ok: true, status: 'running' })
      }
      // 10분 이상이면 stuck된 것으로 판단, 재실행 진행
    }

    const { data: participantRows } = await supabase
      .from('interaction_participants')
      .select('clone_id, clones(*)')
      .eq('interaction_id', id)

    const participants = (participantRows ?? [])
      .map((r) => (r as unknown as { clones: Clone }).clones)
      .filter(Boolean)

    if (participants.length !== 2) throw errors.validation('참여자가 2명이어야 합니다')

    const admin = createServiceClient()

    // 메모리 fetch
    const memoriesByClone = new Map<string, CloneMemory[]>()
    for (const p of participants) {
      const { data: mems } = await admin
        .from('clone_memories')
        .select('*')
        .eq('clone_id', p.id)
        .order('occurred_at', { ascending: false })
        .limit(10)
      memoriesByClone.set(p.id, (mems ?? []) as CloneMemory[])
    }

    const metadata = (interaction.metadata ?? {}) as { scenarioId?: string }
    const scenarioId = metadata.scenarioId ?? DEFAULT_SCENARIOS[0].id
    const scenario = DEFAULT_SCENARIOS.find((s) => s.id === scenarioId) ?? DEFAULT_SCENARIOS[0]

    // 모듈레이터 오케스트레이션: mood + style cards + world context → enhanced system prompts
    const today = new Date().toISOString().split('T')[0]
    const clonePrompts = await prepareClonePrompts(participants, memoriesByClone, id, today)
    const prebuiltPrompts = new Map<string, string>()
    for (const [cloneId, ctx] of clonePrompts) {
      prebuiltPrompts.set(cloneId, ctx.systemPrompt)
    }

    // status running + started_at
    await admin
      .from('interactions')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', id)

    // 양방향 placeholder 관계 기억 생성 (대화 진행 중 상태)
    if (FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY && participants.length === 2) {
      const [pA, pB] = participants
      for (const [selfId, targetId, targetName] of [
        [pA.id, pB.id, pB.name],
        [pB.id, pA.id, pA.name],
      ] as const) {
        const { data: existing } = await admin
          .from('clone_relationships')
          .select('id')
          .eq('clone_id', selfId)
          .eq('target_clone_id', targetId)
          .maybeSingle()
        if (!existing) {
          await admin.from('clone_relationships').insert({
            clone_id: selfId,
            target_clone_id: targetId,
            interaction_count: 0,
            summary: `${targetName}와(과) 대화가 진행 중이에요...`,
            memories: [],
          })
        }
      }
    }

    let result: Awaited<ReturnType<typeof runInteraction>>
    try {
      result = await runInteraction({
        interactionId: id,
        participants,
        memoriesByClone,
        scenario: {
          id: scenario.id,
          label: scenario.label,
          description: scenario.description,
        },
        setting: interaction.setting,
        maxTurns: interaction.max_turns,
        prebuiltPrompts,
        startedAt: Date.now(),
      })
    } catch (engineErr) {
      // 엔진 자체가 throw한 경우에도 status를 failed로 업데이트
      const reason = engineErr instanceof Error ? engineErr.message : String(engineErr)
      await admin
        .from('interactions')
        .update({
          status: 'failed',
          ended_at: new Date().toISOString(),
          metadata: { ...metadata, failure_reason: reason },
        })
        .eq('id', id)
      throw engineErr
    }

    await admin
      .from('interactions')
      .update({
        status: result.status,
        ended_at: new Date().toISOString(),
        metadata: {
          ...metadata,
          ...(result.failureReason ? { failure_reason: result.failureReason } : {}),
          turnsCompleted: result.turnsCompleted,
        },
      })
      .eq('id', id)

    // 관계 기억 자동 추출 (feature flag + completed 일 때만)
    if (FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY && result.status === 'completed') {
      const { data: events } = await admin
        .from('interaction_events')
        .select('*')
        .eq('interaction_id', id)
        .order('turn_number', { ascending: true })

      if (events && events.length > 0) {
        // fire-and-forget: 실패해도 응답에 영향 없음
        extractRelationshipMemories(
          events as InteractionEvent[],
          participants.map((p) => ({
            id: p.id,
            name: p.name,
            persona_json: p.persona_json,
          })),
          id,
        ).catch((err) => {
          console.error('[relationship] extraction failed (non-blocking):', err)
        })
      }
    }

    return NextResponse.json({ ok: true, status: result.status })
  } catch (err) {
    return toErrorResponse(err)
  }
}
