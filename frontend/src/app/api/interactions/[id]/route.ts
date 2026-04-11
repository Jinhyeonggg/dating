import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errors, AppError } from '@/lib/errors'

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

export async function GET(
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

    const { data: interaction, error: iErr } = await supabase
      .from('interactions')
      .select(
        '*, interaction_participants(clone_id, clones(id, name, is_npc, persona_json))'
      )
      .eq('id', id)
      .single()

    if (iErr || !interaction) throw errors.notFound('Interaction')

    const { data: events } = await supabase
      .from('interaction_events')
      .select('*')
      .eq('interaction_id', id)
      .order('turn_number', { ascending: true })

    return NextResponse.json({ interaction, events: events ?? [] })
  } catch (err) {
    return toErrorResponse(err)
  }
}
