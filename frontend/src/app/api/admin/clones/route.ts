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

    const { data: clones, error } = await service
      .from('clones')
      .select('id, name, user_id, is_npc, is_public, is_active, created_at, updated_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) throw new AppError('INTERNAL', error.message, 500)

    // user_id → email 매핑 (profiles 테이블 별도 조회)
    const userIds = [...new Set((clones ?? []).map((c) => c.user_id).filter(Boolean))] as string[]
    const emailMap = new Map<string, string>()
    if (userIds.length > 0) {
      const { data: profiles } = await service
        .from('profiles')
        .select('id, email')
        .in('id', userIds)
      for (const p of profiles ?? []) {
        if (p.email) emailMap.set(p.id, p.email)
      }
    }

    const data = (clones ?? []).map((c) => ({
      ...c,
      owner_email: c.user_id ? emailMap.get(c.user_id) ?? null : null,
    }))

    return NextResponse.json({ data })
  } catch (err) {
    return toErrorResponse(err)
  }
}
