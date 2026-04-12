import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin/guard'
import { copyWorldContextSchema } from '@/lib/validation/worldContext'
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

export async function POST(request: Request) {
  try {
    await requireAdmin()

    const body = await request.json()
    const parsed = copyWorldContextSchema.safeParse(body)
    if (!parsed.success) {
      throw errors.validation('입력 검증 실패', parsed.error.flatten())
    }

    const { from, to } = parsed.data
    const service = createServiceClient()

    const { data: rows, error: fetchError } = await service
      .from('world_context')
      .select('category, headline, details, weight')
      .eq('date', from)

    if (fetchError) throw errors.validation(fetchError.message)
    if (!rows || rows.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const inserts = rows.map((row) => ({ ...row, date: to }))
    const { data, error: insertError } = await service
      .from('world_context')
      .insert(inserts)
      .select()

    if (insertError) throw errors.validation(insertError.message)

    return NextResponse.json({ data: data ?? [] }, { status: 201 })
  } catch (err) {
    return toErrorResponse(err)
  }
}
