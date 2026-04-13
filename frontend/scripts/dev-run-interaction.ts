// frontend/scripts/dev-run-interaction.ts
/**
 * CLI 실행:
 *   cd frontend
 *   npx tsx scripts/dev-run-interaction.ts <cloneA-id> <cloneB-id> [scenarioId]
 *
 * 동작:
 * 1. Supabase service role 로 직접 접속
 * 2. 두 Clone fetch
 * 3. interactions + participants 행 생성 (status='running')
 * 4. runInteraction() 호출
 * 5. 완료 후 interaction_events 전부 fetch 해서 터미널 출력
 * 6. 전사를 체크리스트와 함께 보기 쉽게 표시
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { runInteraction } from '../src/lib/interaction/engine'
import { CONVERSATION_MOODS, INTERACTION_DEFAULTS } from '../src/lib/config/interaction'
import type { Clone } from '../src/types/persona'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
  const [cloneAId, cloneBId, scenarioId = 'casual'] = process.argv.slice(2)
  if (!cloneAId || !cloneBId) {
    console.error('Usage: dev-run-interaction.ts <cloneA-id> <cloneB-id> [scenarioId]')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) {
    console.error('env missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  const admin = createClient(url, key)

  // 1. Clones fetch
  const { data: clones, error: cErr } = await admin
    .from('clones')
    .select('*')
    .in('id', [cloneAId, cloneBId])
  if (cErr || !clones || clones.length !== 2) {
    console.error('clones not found', cErr)
    process.exit(1)
  }
  const participants = [
    clones.find((c) => c.id === cloneAId),
    clones.find((c) => c.id === cloneBId),
  ].filter(Boolean) as Clone[]

  // 2. Scenario
  const scenario = CONVERSATION_MOODS.find((s: { id: string }) => s.id === scenarioId)
  if (!scenario) {
    console.error(`unknown scenario: ${scenarioId}`)
    process.exit(1)
  }

  // 3. Interaction row
  const { data: interaction, error: iErr } = await admin
    .from('interactions')
    .insert({
      kind: 'dev-cli',
      scenario: scenario.label,
      setting: null,
      status: 'running',
      max_turns: INTERACTION_DEFAULTS.MAX_TURNS,
      metadata: { scenarioId: scenario.id, dev: true },
      started_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (iErr || !interaction) {
    console.error('interaction insert failed', iErr)
    process.exit(1)
  }

  await admin.from('interaction_participants').insert(
    participants.map((p) => ({
      interaction_id: interaction.id,
      clone_id: p.id,
      role: 'speaker',
    }))
  )

  console.log(`\n▶ Interaction ${interaction.id}`)
  console.log(`  ${participants[0].name} × ${participants[1].name}`)
  console.log(`  Scenario: ${scenario.label}\n`)

  // 4. Run engine
  const result = await runInteraction({
    interactionId: interaction.id,
    participants,
    memoriesByClone: new Map(),
    scenario: {
      id: scenario.id,
      label: scenario.label,
      description: scenario.description,
    },
    setting: null,
    maxTurns: INTERACTION_DEFAULTS.MAX_TURNS,
  })

  // 5. Status update
  await admin
    .from('interactions')
    .update({
      status: result.status,
      ended_at: new Date().toISOString(),
      metadata: result.failureReason
        ? { failure_reason: result.failureReason }
        : undefined,
    })
    .eq('id', interaction.id)

  // 6. Fetch events & print transcript
  const { data: events } = await admin
    .from('interaction_events')
    .select('*')
    .eq('interaction_id', interaction.id)
    .order('turn_number', { ascending: true })

  console.log('\n─── TRANSCRIPT ───\n')
  for (const e of events ?? []) {
    const name =
      participants.find((p) => p.id === e.speaker_clone_id)?.name ?? '?'
    console.log(`${name}: ${e.content}\n`)
  }
  console.log(`\n[${result.status}] ${result.turnsCompleted} turns`)
  if (result.failureReason) console.log(`  reason: ${result.failureReason}`)

  console.log('\n─── REALISM CHECK ───')
  console.log('위 전사를 보고 아래 항목을 수동 확인:')
  console.log('  [ ] 두 페르소나의 말투·어휘가 구분되는가?')
  console.log('  [ ] 짧은 턴과 긴 턴이 섞여 있는가?')
  console.log('  [ ] 매 턴마다 질문이 아닌가? (질문:진술 ~ 3:7)')
  console.log('  [ ] "AI로서" / 과한 공감 / 어시스턴트 톤이 없는가?')
  console.log('  [ ] dealbreakers·core_values 반응이 자연스러운가?')
  console.log('')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
