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

const ALL_KEYS = [
  'interaction_mode',
  'relationship_memory_enabled',
  'pair_memory_injection',
  'other_memory_injection',
  'pair_memory_injection_limit',
  'other_memory_injection_limit',
]

function buildResponse(configMap: Map<string, unknown>) {
  return {
    interactionMode: configMap.get('interaction_mode') ?? 'economy',
    relationshipMemoryEnabled: configMap.get('relationship_memory_enabled') ?? true,
    pairMemoryInjection: configMap.get('pair_memory_injection') ?? true,
    otherMemoryInjection: configMap.get('other_memory_injection') ?? false,
    pairMemoryInjectionLimit: configMap.get('pair_memory_injection_limit') ?? 20,
    otherMemoryInjectionLimit: configMap.get('other_memory_injection_limit') ?? 0,
  }
}

/** GET /api/admin/config — 현재 설정 조회 */
export async function GET() {
  try {
    await requireAdmin()
    const service = createServiceClient()
    const { data, error } = await service
      .from('platform_config')
      .select('key, value')
      .in('key', ALL_KEYS)

    if (error) throw new AppError('INTERNAL', error.message, 500)

    const configMap = new Map(
      (data ?? []).map((row) => [row.key, row.value])
    )

    return NextResponse.json(buildResponse(configMap))
  } catch (err) {
    return toErrorResponse(err)
  }
}

const VALID_MODES: InteractionMode[] = ['economy', 'sonnet-10', 'sonnet-15', 'normal']

type PatchField = {
  bodyKey: string
  dbKey: string
  validate: (v: unknown) => boolean
  errorMsg: string
}

const PATCH_FIELDS: PatchField[] = [
  {
    bodyKey: 'interactionMode',
    dbKey: 'interaction_mode',
    validate: (v) => VALID_MODES.includes(v as InteractionMode),
    errorMsg: 'Invalid interaction mode',
  },
  {
    bodyKey: 'relationshipMemoryEnabled',
    dbKey: 'relationship_memory_enabled',
    validate: (v) => typeof v === 'boolean',
    errorMsg: 'relationshipMemoryEnabled must be boolean',
  },
  {
    bodyKey: 'pairMemoryInjection',
    dbKey: 'pair_memory_injection',
    validate: (v) => typeof v === 'boolean',
    errorMsg: 'pairMemoryInjection must be boolean',
  },
  {
    bodyKey: 'otherMemoryInjection',
    dbKey: 'other_memory_injection',
    validate: (v) => typeof v === 'boolean',
    errorMsg: 'otherMemoryInjection must be boolean',
  },
  {
    bodyKey: 'pairMemoryInjectionLimit',
    dbKey: 'pair_memory_injection_limit',
    validate: (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0,
    errorMsg: 'pairMemoryInjectionLimit must be non-negative integer',
  },
  {
    bodyKey: 'otherMemoryInjectionLimit',
    dbKey: 'other_memory_injection_limit',
    validate: (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0,
    errorMsg: 'otherMemoryInjectionLimit must be non-negative integer',
  },
]

/** PATCH /api/admin/config — 설정 변경 */
export async function PATCH(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json()
    const service = createServiceClient()
    const now = new Date().toISOString()

    for (const field of PATCH_FIELDS) {
      if (body[field.bodyKey] !== undefined) {
        if (!field.validate(body[field.bodyKey])) {
          throw new AppError('VALIDATION', field.errorMsg, 400)
        }
        await service
          .from('platform_config')
          .upsert({
            key: field.dbKey,
            value: body[field.bodyKey],
            updated_at: now,
          })
      }
    }

    // 변경 후 현재 상태 반환
    const { data } = await service
      .from('platform_config')
      .select('key, value')
      .in('key', ALL_KEYS)

    const configMap = new Map(
      (data ?? []).map((row) => [row.key, row.value])
    )

    return NextResponse.json(buildResponse(configMap))
  } catch (err) {
    return toErrorResponse(err)
  }
}
