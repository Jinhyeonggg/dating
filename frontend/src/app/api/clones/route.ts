import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createCloneSchema } from '@/lib/validation/persona'
import { buildSystemPrompt } from '@/lib/prompts/persona'
import { errors, AppError } from '@/lib/errors'
import type { Persona, Clone } from '@/types/persona'

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const { data: mine, error: mineError } = await supabase
      .from('clones')
      .select('*')
      .eq('is_npc', false)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (mineError) throw errors.validation(mineError.message)

    const { data: npcs, error: npcsError } = await supabase
      .from('clones')
      .select('*')
      .eq('is_npc', true)
      .is('deleted_at', null)
      .order('name')

    if (npcsError) throw errors.validation(npcsError.message)

    return NextResponse.json({
      mine: mine ?? [],
      npcs: npcs ?? [],
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const body = await request.json()
    const parsed = createCloneSchema.safeParse(body)
    if (!parsed.success) {
      throw errors.validation('입력 검증 실패', parsed.error.flatten())
    }

    const persona = parsed.data.persona as unknown as Persona
    const systemPrompt = buildSystemPrompt(persona, [])

    const admin = createServiceClient()
    const { data, error } = await admin
      .from('clones')
      .insert({
        user_id: user.id,
        is_npc: false,
        name: persona.name,
        persona_json: persona,
        system_prompt: systemPrompt,
      })
      .select()
      .single()

    if (error) throw errors.validation(error.message)

    return NextResponse.json({ clone: data as Clone })
  } catch (err) {
    return toErrorResponse(err)
  }
}
