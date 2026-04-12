import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { errors, AppError } from '@/lib/errors'

function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status })
  }
  return NextResponse.json({ error: { code: 'INTERNAL', message: '서버 오류' } }, { status: 500 })
}

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    // 내 clone IDs
    const { data: myClones } = await supabase
      .from('clones')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_npc', false)
      .is('deleted_at', null)
    const myCloneIds = (myClones ?? []).map((c) => c.id)

    if (myCloneIds.length === 0) {
      return NextResponse.json({ ok: true })
    }

    // 내 clone이 참여한 해당 interaction의 participant를 seen 처리
    const admin = createServiceClient()
    await admin
      .from('interaction_participants')
      .update({ seen_at: new Date().toISOString() })
      .eq('interaction_id', id)
      .in('clone_id', myCloneIds)
      .is('seen_at', null)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
