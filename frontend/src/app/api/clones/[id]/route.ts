import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { updateCloneSchema } from '@/lib/validation/persona'
import { buildSystemPrompt } from '@/lib/prompts/persona'
import { errors, AppError } from '@/lib/errors'
import type { Persona } from '@/types/persona'

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const { data: clone, error } = await supabase
      .from('clones')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !clone) throw errors.notFound('Clone')

    const { data: memories } = await supabase
      .from('clone_memories')
      .select('*')
      .eq('clone_id', id)
      .order('occurred_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      clone,
      memories: memories ?? [],
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const { data: existing } = await supabase
      .from('clones')
      .select('id, is_npc, user_id, persona_json')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!existing) throw errors.notFound('Clone')
    if (existing.is_npc) throw errors.forbidden()
    if (existing.user_id !== user.id) throw errors.forbidden()

    const body = await request.json()
    const parsed = updateCloneSchema.safeParse(body)
    if (!parsed.success) {
      throw errors.validation('입력 검증 실패', parsed.error.flatten())
    }

    const admin = createServiceClient()
    const updates: Record<string, unknown> = {}

    if (parsed.data.persona !== undefined) {
      const merged = {
        ...(existing.persona_json as Persona),
        ...parsed.data.persona,
      } as Persona
      updates.persona_json = merged
      updates.system_prompt = buildSystemPrompt(merged, [])
      if (parsed.data.persona.name) {
        updates.name = parsed.data.persona.name
      }
    }
    if (parsed.data.name) updates.name = parsed.data.name
    if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active

    const { data, error } = await admin
      .from('clones')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw errors.validation(error.message)
    return NextResponse.json({ clone: data })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const { data: existing } = await supabase
      .from('clones')
      .select('id, is_npc, user_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!existing) throw errors.notFound('Clone')
    if (existing.is_npc) throw errors.forbidden()
    if (existing.user_id !== user.id) throw errors.forbidden()

    const admin = createServiceClient()
    const { error } = await admin
      .from('clones')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw errors.validation(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
