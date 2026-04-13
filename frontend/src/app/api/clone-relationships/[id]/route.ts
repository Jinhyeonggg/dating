import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { errors, AppError } from '@/lib/errors'

function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status }
    )
  }
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: '서버 오류' } },
    { status: 500 }
  )
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    // 본인 clone의 관계인지 확인
    const admin = createServiceClient()
    const { data: rel } = await admin
      .from('clone_relationships')
      .select('id, clone_id, clones!clone_relationships_clone_id_fkey(user_id)')
      .eq('id', id)
      .single()

    if (!rel) throw errors.notFound('관계 기억')

    const cloneOwner = (rel as unknown as { clones: { user_id: string } }).clones?.user_id
    if (cloneOwner !== user.id) throw errors.forbidden()

    const { error } = await admin
      .from('clone_relationships')
      .delete()
      .eq('id', id)

    if (error) throw errors.validation(error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
