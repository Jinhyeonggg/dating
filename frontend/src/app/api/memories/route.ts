import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createMemorySchema } from '@/lib/validation/memory'
import { extractAndStoreMemory } from '@/lib/memory/service'
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

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const cloneId = new URL(request.url).searchParams.get('cloneId')
    if (!cloneId) throw errors.validation('cloneId 쿼리 필요')

    const { data: clone } = await supabase
      .from('clones')
      .select('id, user_id, is_npc')
      .eq('id', cloneId)
      .maybeSingle<Pick<Clone, 'id' | 'user_id' | 'is_npc'>>()
    if (!clone) throw errors.notFound('Clone')
    if (clone.is_npc) throw errors.forbidden()
    if (clone.user_id !== user.id) throw errors.forbidden()

    const { data, error } = await supabase
      .from('clone_memories')
      .select('*')
      .eq('clone_id', cloneId)
      .order('occurred_at', { ascending: false })
      .limit(50)
    if (error) throw errors.validation(error.message)

    return NextResponse.json({ memories: data ?? [] })
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
    const parsed = createMemorySchema.safeParse(body)
    if (!parsed.success) {
      throw errors.validation('입력 검증 실패', parsed.error.flatten())
    }

    const { data: clone } = await supabase
      .from('clones')
      .select('id, user_id, is_npc')
      .eq('id', parsed.data.cloneId)
      .maybeSingle<Pick<Clone, 'id' | 'user_id' | 'is_npc'>>()
    if (!clone) throw errors.notFound('Clone')
    if (clone.is_npc) throw errors.forbidden()
    if (clone.user_id !== user.id) throw errors.forbidden()

    const memory = await extractAndStoreMemory(
      parsed.data.cloneId,
      parsed.data.rawText
    )

    return NextResponse.json({ memory })
  } catch (err) {
    return toErrorResponse(err)
  }
}
