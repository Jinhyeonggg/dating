import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/service'
import { AppError } from '@/lib/errors'
import type { InteractionMode } from '@/lib/config/runtime'

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

/** GET /api/admin/config — 현재 설정 조회 */
export async function GET() {
  try {
    await requireAdmin()
    const service = createServiceClient()
    const { data, error } = await service
      .from('platform_config')
      .select('key, value')
      .in('key', ['interaction_mode', 'relationship_memory_enabled'])

    if (error) throw new AppError('INTERNAL', error.message, 500)

    const configMap = new Map(
      (data ?? []).map((row) => [row.key, row.value])
    )

    return NextResponse.json({
      interactionMode: configMap.get('interaction_mode') ?? 'economy',
      relationshipMemoryEnabled: configMap.get('relationship_memory_enabled') ?? true,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

const VALID_MODES: InteractionMode[] = ['economy', 'normal']

/** PATCH /api/admin/config — 설정 변경 */
export async function PATCH(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json()
    const service = createServiceClient()
    const now = new Date().toISOString()

    if (body.interactionMode !== undefined) {
      if (!VALID_MODES.includes(body.interactionMode)) {
        throw new AppError('VALIDATION', `Invalid mode: ${body.interactionMode}`, 400)
      }
      await service
        .from('platform_config')
        .upsert({
          key: 'interaction_mode',
          value: body.interactionMode,
          updated_at: now,
        })
    }

    if (body.relationshipMemoryEnabled !== undefined) {
      if (typeof body.relationshipMemoryEnabled !== 'boolean') {
        throw new AppError('VALIDATION', 'relationshipMemoryEnabled must be boolean', 400)
      }
      await service
        .from('platform_config')
        .upsert({
          key: 'relationship_memory_enabled',
          value: body.relationshipMemoryEnabled,
          updated_at: now,
        })
    }

    // 변경 후 현재 상태 반환
    const { data } = await service
      .from('platform_config')
      .select('key, value')
      .in('key', ['interaction_mode', 'relationship_memory_enabled'])

    const configMap = new Map(
      (data ?? []).map((row) => [row.key, row.value])
    )

    return NextResponse.json({
      interactionMode: configMap.get('interaction_mode') ?? 'economy',
      relationshipMemoryEnabled: configMap.get('relationship_memory_enabled') ?? true,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
