import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { submitOnboardingSchema } from '@/lib/validation/onboarding'
import { inferAndStoreTraits } from '@/lib/onboarding/service'
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

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    // 본인 Clone인지 확인
    const { data: clone, error: cloneErr } = await supabase
      .from('clones')
      .select('id, user_id')
      .eq('id', id)
      .single()
    if (cloneErr || !clone) throw errors.notFound('Clone')
    if (clone.user_id !== user.id) throw errors.forbidden()

    const body = await request.json()
    const parsed = submitOnboardingSchema.safeParse(body)
    if (!parsed.success) {
      throw errors.validation('온보딩 응답이 유효하지 않습니다', parsed.error.flatten())
    }

    const inferredTraits = await inferAndStoreTraits(id, parsed.data.answers)

    return NextResponse.json({ ok: true, inferredTraits })
  } catch (err) {
    return toErrorResponse(err)
  }
}
