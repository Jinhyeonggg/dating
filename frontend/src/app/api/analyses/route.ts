// frontend/src/app/api/analyses/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateOrFetchAnalysis } from '@/lib/analysis/service'
import { createAnalysisSchema } from '@/lib/validation/analysis'
import { errors, AppError } from '@/lib/errors'
import type { Clone, Persona } from '@/types/persona'
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

export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = createAnalysisSchema.safeParse(body)
    if (!parsed.success) {
      throw errors.validation('요청 본문이 유효하지 않습니다', parsed.error.flatten())
    }
    const { interactionId } = parsed.data

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const { data: interaction, error: iErr } = await supabase
      .from('interactions')
      .select('*')
      .eq('id', interactionId)
      .single()
    if (iErr || !interaction) throw errors.notFound('Interaction')
    if (interaction.created_by !== user.id) throw errors.forbidden()
    if (interaction.status !== 'completed') {
      throw errors.validation('완료된 상호작용만 분석할 수 있습니다')
    }

    const { data: eventRows, error: eErr } = await supabase
      .from('interaction_events')
      .select('*')
      .eq('interaction_id', interactionId)
      .order('turn_number', { ascending: true })
    if (eErr) throw errors.internal()
    const events = (eventRows ?? []) as unknown as InteractionEvent[]

    const { data: participantRows } = await supabase
      .from('interaction_participants')
      .select('clone_id, clones(*)')
      .eq('interaction_id', interactionId)

    const participants = (participantRows ?? [])
      .map((r) => (r as unknown as { clones: Clone }).clones)
      .filter(Boolean)

    const personas = new Map<string, Persona>()
    for (const c of participants) {
      personas.set(c.id, c.persona_json)
    }

    const analysis = await generateOrFetchAnalysis({
      interactionId,
      events,
      personas,
    })

    return NextResponse.json({ analysis })
  } catch (err) {
    return toErrorResponse(err)
  }
}
