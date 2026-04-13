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

/**
 * POST /api/admin/interactions — stuck interaction 정리
 * 1시간 이상 running 상태인 interaction을 failed로 변경
 */
export async function POST() {
  try {
    await requireAdmin()
    const service = createServiceClient()

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { data, error } = await service
      .from('interactions')
      .update({
        status: 'failed',
        ended_at: new Date().toISOString(),
        metadata: { failure_reason: 'stuck_cleanup: running 상태로 1시간 이상 방치' },
      })
      .eq('status', 'running')
      .lt('started_at', oneHourAgo)
      .select('id')

    if (error) throw new AppError('INTERNAL', error.message, 500)

    return NextResponse.json({ ok: true, cleaned: data?.length ?? 0 })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function GET() {
  try {
    await requireAdmin()
    const service = createServiceClient()

    const { data, error } = await service
      .from('interactions')
      .select(`*, interaction_participants ( clone_id, role, clones ( id, name, is_npc, user_id ) )`)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw new AppError('INTERNAL', error.message, 500)

    return NextResponse.json({ data })
  } catch (err) {
    return toErrorResponse(err)
  }
}
