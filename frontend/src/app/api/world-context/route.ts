import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin/guard'
import { createWorldContextSchema } from '@/lib/validation/worldContext'
import { errors, AppError } from '@/lib/errors'

function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status }
    )
  }
  console.error('Unhandled:', err)
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: '서버 오류' } },
    { status: 500 }
  )
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw errors.validation('date 파라미터가 필요합니다 (YYYY-MM-DD)')
    }

    const { data, error } = await supabase
      .from('world_context')
      .select('*')
      .eq('date', date)
      .order('weight', { ascending: false })

    if (error) throw errors.validation(error.message)

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()

    const body = await request.json()
    const parsed = createWorldContextSchema.safeParse(body)
    if (!parsed.success) {
      throw errors.validation('입력 검증 실패', parsed.error.flatten())
    }

    const service = createServiceClient()
    const { data, error } = await service
      .from('world_context')
      .insert(parsed.data)
      .select()
      .single()

    if (error) throw errors.validation(error.message)

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return toErrorResponse(err)
  }
}
