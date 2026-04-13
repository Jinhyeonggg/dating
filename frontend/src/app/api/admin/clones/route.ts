import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/service'
import { AppError } from '@/lib/errors'

function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status }
    )
  }
  console.error('Unhandled:', err)
  return NextResponse.json({ error: { code: 'INTERNAL', message: '서버 오류' } }, { status: 500 })
}

export async function GET() {
  try {
    await requireAdmin()
    const service = createServiceClient()

    const { data, error } = await service
      .from('clones')
      .select('id, name, user_id, is_npc, is_public, is_active, created_at, updated_at, profiles(email)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) throw new AppError('INTERNAL', error.message, 500)

    return NextResponse.json({ data })
  } catch (err) {
    return toErrorResponse(err)
  }
}
