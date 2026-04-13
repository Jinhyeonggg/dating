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
 * DELETE /api/admin/clones/[id]
 * Clone + 관련 interaction 모두 삭제
 */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await ctx.params
    const service = createServiceClient()

    // 1. 이 clone이 참여한 interaction ID 조회
    const { data: participations } = await service
      .from('interaction_participants')
      .select('interaction_id')
      .eq('clone_id', id)

    const interactionIds = (participations ?? []).map((p) => p.interaction_id)

    // 2. 관련 interaction 삭제 (cascade: events, participants, analyses)
    if (interactionIds.length > 0) {
      const { error: iErr } = await service
        .from('interactions')
        .delete()
        .in('id', interactionIds)
      if (iErr) throw new AppError('INTERNAL', `interaction 삭제 실패: ${iErr.message}`, 500)
    }

    // 3. clone memories 삭제
    await service
      .from('clone_memories')
      .delete()
      .eq('clone_id', id)

    // 4. clone 삭제
    const { error: cErr } = await service
      .from('clones')
      .delete()
      .eq('id', id)

    if (cErr) throw new AppError('INTERNAL', `clone 삭제 실패: ${cErr.message}`, 500)

    return NextResponse.json({ ok: true, deletedInteractions: interactionIds.length })
  } catch (err) {
    return toErrorResponse(err)
  }
}
