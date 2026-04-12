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

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const { data: myClones } = await supabase
      .from('clones')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_npc', false)
      .is('deleted_at', null)
    const myCloneIds = (myClones ?? []).map((c) => c.id)

    if (myCloneIds.length === 0) {
      return NextResponse.json({ unread: [], count: 0 })
    }

    const admin = createServiceClient()

    // 내 clone이 참여하고, 내가 시작하지 않았고, 아직 안 본 interaction
    const { data: unseen } = await admin
      .from('interaction_participants')
      .select(`
        interaction_id,
        seen_at,
        interactions!inner (
          id, status, scenario, created_at, created_by,
          interaction_participants ( clone_id, clones ( id, name ) )
        )
      `)
      .in('clone_id', myCloneIds)
      .is('seen_at', null)
      .neq('interactions.created_by', user.id)
      .order('interactions(created_at)', { ascending: false })
      .limit(20)

    const unread = (unseen ?? []).map((row) => {
      const interaction = row.interactions as unknown as {
        id: string
        status: string
        scenario: string
        created_at: string
        interaction_participants: Array<{ clone_id: string; clones: { id: string; name: string } }>
      }
      const names = interaction.interaction_participants
        ?.map((p) => p.clones?.name ?? '?')
        .join(' × ') ?? '?'

      return {
        interaction_id: interaction.id,
        status: interaction.status,
        scenario: interaction.scenario,
        created_at: interaction.created_at,
        names,
      }
    })

    return NextResponse.json({ unread, count: unread.length })
  } catch (err) {
    return toErrorResponse(err)
  }
}
