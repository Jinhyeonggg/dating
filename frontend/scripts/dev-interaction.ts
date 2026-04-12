/**
 * Dev CLI: realism tuning loop
 *
 * Usage:
 *   bun scripts/dev-interaction.ts --pair=<id1>,<id2> [options]
 *
 * Options:
 *   --pair=id1,id2         Clone IDs to run (required)
 *   --scenario=<id>        Scenario ID (default: online-first-match)
 *   --mood-seed=<str>      Deterministic mood seed override
 *   --turns=N              Max turns (default: 20)
 *   --help                 Show this help
 *
 * Tuning workflow:
 *   1. lib/prompts/texture.ts 또는 lib/styles/cards/ 수정
 *   2. bun scripts/dev-interaction.ts --pair=<ids>
 *   3. 아래 체크리스트로 결과 평가
 *   4. 만족할 때까지 반복
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { createServiceClient } from '../src/lib/supabase/service'
import { prepareClonePrompts } from '../src/lib/interaction/orchestrate'
import { runInteraction } from '../src/lib/interaction/engine'
import { DEFAULT_SCENARIOS, INTERACTION_DEFAULTS } from '../src/lib/config/interaction'
import type { Clone, CloneMemory } from '../src/types/persona'

// ── ANSI colors ────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
} as const

// Speaker colors: first clone → cyan, second → magenta
const SPEAKER_COLORS = [C.cyan, C.magenta]

// ── Arg parsing ────────────────────────────────────────────────────────────
interface ParsedArgs {
  pair: [string, string] | null
  scenario: string
  moodSeed: string | null
  turns: number
  help: boolean
}

const NPC_ALIASES: Record<string, string> = {
  '1': '00000000-0000-0000-0000-000000000001',
  '2': '00000000-0000-0000-0000-000000000002',
  '3': '00000000-0000-0000-0000-000000000003',
  '4': '00000000-0000-0000-0000-000000000004',
  '5': '00000000-0000-0000-0000-000000000005',
  '지민': '00000000-0000-0000-0000-000000000001',
  '태현': '00000000-0000-0000-0000-000000000002',
  '서연': '00000000-0000-0000-0000-000000000003',
  '민재': '00000000-0000-0000-0000-000000000004',
  '하린': '00000000-0000-0000-0000-000000000005',
}

function promptUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stderr })
    rl.question(question, (answer: string) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function resolveCloneId(input: string): Promise<string> {
  if (NPC_ALIASES[input]) return NPC_ALIASES[input]
  if (input.match(/^[0-9a-f]{8}-/)) return input

  const db = createServiceClient()
  const { data } = await db
    .from('clones')
    .select('id, name, is_npc')
    .ilike('name', input)

  if (!data || data.length === 0) {
    console.error(`${C.red}Error: clone "${input}" 을 찾을 수 없습니다${C.reset}`)
    process.exit(1)
  }

  if (data.length === 1) return data[0].id

  console.error(`${C.yellow}"${input}" 이 ${data.length}명 있습니다:${C.reset}`)
  for (let i = 0; i < data.length; i++) {
    console.error(`  ${C.bold}${i + 1}${C.reset}. ${data[i].name}${data[i].is_npc ? ' (NPC)' : ''}  ${C.dim}${data[i].id}${C.reset}`)
  }
  const answer = await promptUser(`번호 선택 (1-${data.length}): `)
  const idx = parseInt(answer, 10) - 1
  if (isNaN(idx) || idx < 0 || idx >= data.length) {
    console.error(`${C.red}잘못된 선택${C.reset}`)
    process.exit(1)
  }
  return data[idx].id
}

function parseArgs(): ParsedArgs {
  const argv = process.argv.slice(2)
  const result: ParsedArgs = {
    pair: null,
    scenario: 'online-first-match',
    moodSeed: null,
    turns: INTERACTION_DEFAULTS.MAX_TURNS,
    help: false,
  }

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      result.help = true
    } else if (arg.startsWith('--pair=')) {
      const parts = arg.slice('--pair='.length).split(',')
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        console.error(`${C.red}Error: --pair must be two comma-separated IDs${C.reset}`)
        process.exit(1)
      }
      result.pair = [parts[0].trim(), parts[1].trim()]
    } else if (arg.startsWith('--scenario=')) {
      result.scenario = arg.slice('--scenario='.length).trim()
    } else if (arg.startsWith('--mood-seed=')) {
      result.moodSeed = arg.slice('--mood-seed='.length).trim()
    } else if (arg.startsWith('--turns=')) {
      const n = parseInt(arg.slice('--turns='.length), 10)
      if (isNaN(n) || n <= 0) {
        console.error(`${C.red}Error: --turns must be a positive integer${C.reset}`)
        process.exit(1)
      }
      result.turns = n
    } else {
      console.error(`${C.red}Error: unknown argument: ${arg}${C.reset}`)
      process.exit(1)
    }
  }

  return result
}

// ── Help ───────────────────────────────────────────────────────────────────
function printHelp(): void {
  console.log(`
${C.bold}dev-interaction${C.reset} — realism tuning loop for Digital Clone Platform

${C.bold}USAGE${C.reset}
  bun scripts/dev-interaction.ts --pair=<id1>,<id2> [options]

${C.bold}OPTIONS${C.reset}
  --pair=id1,id2        Clone IDs or aliases (required)
                        aliases: 1~5 or 지민/태현/서연/민재/하린
  --scenario=<id>       Scenario ID (default: online-first-match)
                        Available: ${DEFAULT_SCENARIOS.map((s) => s.id).join(', ')}
  --mood-seed=<str>     Deterministic mood seed override
  --turns=N             Max turns (default: ${INTERACTION_DEFAULTS.MAX_TURNS})
  --help                Show this help

${C.bold}TUNING WORKFLOW${C.reset}
  1. lib/prompts/texture.ts 또는 lib/styles/cards/ 수정
  2. bun scripts/dev-interaction.ts --pair=<ids>
  3. 아래 체크리스트로 결과 평가
  4. 만족할 때까지 반복

${C.bold}CHECKLIST TARGETS${C.reset}
  Period rate          마침표('.') 비율 — target < 10%
  Consecutive rate     연속 발화 비율 — target > 30%
  Emotion char rate    감정 문자(ㅋㅋ/ㅠㅠ/ㅎㅎ) — target > 15%
  Formal connectives   격식 접속어("또한", "그러므로" 등) — target 0
`)
}

// ── Checklist evaluation ───────────────────────────────────────────────────
interface ChecklistResult {
  periodRate: number
  consecutiveRate: number
  emotionRate: number
  formalConnectives: number
}

const FORMAL_CONNECTIVES = ['또한', '그러므로', '따라서', '그러나', '한편'] as const
const EMOTION_RE = /[ㅋㅎㅠㅜ]{2,}/

function evaluateChecklist(
  messages: Array<{ speaker: string; content: string }>
): ChecklistResult {
  const total = messages.length
  if (total === 0) {
    return { periodRate: 0, consecutiveRate: 0, emotionRate: 0, formalConnectives: 0 }
  }

  let periodCount = 0
  let consecutiveCount = 0
  let emotionCount = 0
  let formalCount = 0

  let lastSpeaker: string | null = null

  for (const msg of messages) {
    const { speaker, content } = msg

    // Period: ends with '.', '다.', '요.' or just '.'
    if (content.trimEnd().endsWith('.')) {
      periodCount++
    }

    // Consecutive: same speaker as previous
    if (lastSpeaker !== null && speaker === lastSpeaker) {
      consecutiveCount++
    }
    lastSpeaker = speaker

    // Emotion characters: ㅋ/ㅎ/ㅠ/ㅜ appearing 2+ in a row
    if (EMOTION_RE.test(content)) {
      emotionCount++
    }

    // Formal connectives: count all occurrences across all connectives
    for (const connective of FORMAL_CONNECTIVES) {
      const re = new RegExp(connective, 'g')
      const matches = content.match(re)
      if (matches) formalCount += matches.length
    }
  }

  return {
    periodRate: periodCount / total,
    consecutiveRate: consecutiveCount / total,
    emotionRate: emotionCount / total,
    formalConnectives: formalCount,
  }
}

function printChecklist(result: ChecklistResult): void {
  console.log(`\n${C.bold}─── REALISM CHECKLIST ───${C.reset}\n`)

  const pass = (condition: boolean) =>
    condition ? `${C.green}PASS${C.reset}` : `${C.red}FAIL${C.reset}`

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`

  const periodOk = result.periodRate < 0.1
  const consecutiveOk = result.consecutiveRate > 0.3
  const emotionOk = result.emotionRate > 0.15
  const formalOk = result.formalConnectives === 0

  console.log(
    `  ${pass(periodOk)}  Period rate          ${pct(result.periodRate).padStart(6)}  (target < 10%)`
  )
  console.log(
    `  ${pass(consecutiveOk)}  Consecutive rate     ${pct(result.consecutiveRate).padStart(6)}  (target > 30%)`
  )
  console.log(
    `  ${pass(emotionOk)}  Emotion char rate    ${pct(result.emotionRate).padStart(6)}  (target > 15%)`
  )
  console.log(
    `  ${pass(formalOk)}  Formal connectives   ${String(result.formalConnectives).padStart(6)}  (target 0)`
  )

  const allPass = periodOk && consecutiveOk && emotionOk && formalOk
  if (allPass) {
    console.log(`\n  ${C.green}${C.bold}All checks passed!${C.reset}`)
  } else {
    console.log(`\n  ${C.yellow}Some checks failed — tweak texture rules or style cards and re-run.${C.reset}`)
  }
  console.log('')
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = parseArgs()

  if (args.help) {
    printHelp()
    process.exit(0)
  }

  if (!args.pair) {
    console.error(`${C.red}Error: --pair is required${C.reset}`)
    printHelp()
    process.exit(1)
  }

  const [idA, idB] = await Promise.all(args.pair.map(resolveCloneId))

  // Validate env
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error(
      `${C.red}Error: missing env vars NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY${C.reset}`
    )
    process.exit(1)
  }

  // Validate scenario
  const scenario = DEFAULT_SCENARIOS.find((s) => s.id === args.scenario)
  if (!scenario) {
    console.error(
      `${C.red}Error: unknown scenario "${args.scenario}". Available: ${DEFAULT_SCENARIOS.map((s) => s.id).join(', ')}${C.reset}`
    )
    process.exit(1)
  }

  const admin = createServiceClient()

  // 1. Load clones from DB
  console.log(`\n${C.dim}Loading clones...${C.reset}`)
  const { data: cloneRows, error: cloneErr } = await admin
    .from('clones')
    .select('*')
    .in('id', [idA, idB])

  if (cloneErr || !cloneRows || cloneRows.length !== 2) {
    console.error(
      `${C.red}Error: could not load clones (found ${cloneRows?.length ?? 0}/2)${C.reset}`,
      cloneErr?.message ?? ''
    )
    process.exit(1)
  }

  const participants: Clone[] = [
    cloneRows.find((c) => c.id === idA),
    cloneRows.find((c) => c.id === idB),
  ].filter((c): c is Clone => c !== undefined)

  if (participants.length !== 2) {
    console.error(`${C.red}Error: one or both clone IDs not found in DB${C.reset}`)
    process.exit(1)
  }

  // 2. Load memories from DB
  console.log(`${C.dim}Loading memories...${C.reset}`)
  const { data: memoryRows } = await admin
    .from('clone_memories')
    .select('*')
    .in('clone_id', [idA, idB])

  const memoriesByClone = new Map<string, CloneMemory[]>()
  for (const clone of participants) {
    const cloneMemories = (memoryRows ?? []).filter(
      (m) => m.clone_id === clone.id
    ) as CloneMemory[]
    memoriesByClone.set(clone.id, cloneMemories)
  }

  // 3. Create temp interaction record
  console.log(`${C.dim}Creating interaction record...${C.reset}`)
  const { data: interaction, error: interactionErr } = await admin
    .from('interactions')
    .insert({
      kind: 'dev-cli',
      scenario: scenario.label,
      setting: null,
      status: 'running',
      max_turns: args.turns,
      metadata: { scenarioId: scenario.id, dev: true, moodSeed: args.moodSeed },
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (interactionErr || !interaction) {
    console.error(
      `${C.red}Error: interaction insert failed${C.reset}`,
      interactionErr?.message ?? ''
    )
    process.exit(1)
  }

  // 4. Add participants
  const { error: participantErr } = await admin
    .from('interaction_participants')
    .insert(
      participants.map((p) => ({
        interaction_id: interaction.id,
        clone_id: p.id,
        role: 'speaker',
      }))
    )

  if (participantErr) {
    console.error(
      `${C.red}Error: participant insert failed${C.reset}`,
      participantErr.message
    )
    process.exit(1)
  }

  // Print header
  const today = new Date().toISOString().split('T')[0]
  console.log(`\n${C.bold}▶ Interaction ${interaction.id}${C.reset}`)
  console.log(
    `  ${SPEAKER_COLORS[0]}${participants[0].name}${C.reset} × ${SPEAKER_COLORS[1]}${participants[1].name}${C.reset}`
  )
  console.log(`  Scenario: ${scenario.label}`)
  console.log(`  Max turns: ${args.turns}`)

  // 5. prepareClonePrompts — get enhanced system prompts
  console.log(`\n${C.dim}Preparing clone prompts (mood roll + style cards)...${C.reset}`)
  const promptContexts = await prepareClonePrompts(
    participants,
    memoriesByClone,
    interaction.id,
    today,
  )

  // 6. Print mood + card info per clone
  console.log(`\n${C.bold}── Clone context ──${C.reset}`)
  for (let i = 0; i < participants.length; i++) {
    const clone = participants[i]
    const color = SPEAKER_COLORS[i]
    const ctx = promptContexts.get(clone.id)
    if (!ctx) continue
    console.log(
      `  ${color}${C.bold}${clone.name}${C.reset}  mood=${C.yellow}${ctx.mood.primary}${C.reset}` +
        `  energy=${ctx.mood.energy.toFixed(2)}  openness=${ctx.mood.openness.toFixed(2)}  warmth=${ctx.mood.warmth.toFixed(2)}`
    )
    console.log(
      `  ${C.dim}cards: [${ctx.styleCardIds.join(', ')}]  hint: ${ctx.mood.reason_hint}${C.reset}`
    )
  }

  // Build prebuiltPrompts map (clone id → system prompt string)
  const prebuiltPrompts = new Map<string, string>()
  for (const [cloneId, ctx] of promptContexts.entries()) {
    prebuiltPrompts.set(cloneId, ctx.systemPrompt)
  }

  // 7. runInteraction with prebuiltPrompts
  console.log(`\n${C.dim}Running interaction...${C.reset}\n`)
  const result = await runInteraction({
    interactionId: interaction.id,
    participants,
    memoriesByClone,
    scenario: {
      id: scenario.id,
      label: scenario.label,
      description: scenario.description,
    },
    setting: null,
    maxTurns: args.turns,
    prebuiltPrompts,
  })

  // 8. Fetch events from DB
  const { data: events } = await admin
    .from('interaction_events')
    .select('*')
    .eq('interaction_id', interaction.id)
    .order('turn_number', { ascending: true })

  // 9. Print colored transcript
  console.log(`${C.bold}─── TRANSCRIPT ───${C.reset}\n`)

  const colorByCloneId = new Map<string, string>()
  participants.forEach((p, i) => colorByCloneId.set(p.id, SPEAKER_COLORS[i]))

  const transcriptMessages: Array<{ speaker: string; content: string }> = []
  for (const e of events ?? []) {
    const clone = participants.find((p) => p.id === e.speaker_clone_id)
    const name = clone?.name ?? '?'
    const color = colorByCloneId.get(e.speaker_clone_id) ?? C.reset
    console.log(`${color}${C.bold}${name}${C.reset} ${C.dim}[T${e.turn_number}]${C.reset}`)
    console.log(`${e.content}\n`)
    transcriptMessages.push({ speaker: e.speaker_clone_id, content: e.content })
  }

  console.log(
    `${result.status === 'completed' ? C.green : C.red}[${result.status}]${C.reset} ${result.turnsCompleted} turns`
  )
  if (result.failureReason) {
    console.log(`  ${C.red}reason: ${result.failureReason}${C.reset}`)
  }

  // 10. Print checklist evaluation
  const checklistResult = evaluateChecklist(transcriptMessages)
  printChecklist(checklistResult)

  // 11. Update interaction status
  await admin
    .from('interactions')
    .update({
      status: result.status,
      ended_at: new Date().toISOString(),
      ...(result.failureReason
        ? { metadata: { failure_reason: result.failureReason } }
        : {}),
    })
    .eq('id', interaction.id)

  process.exit(result.status === 'completed' ? 0 : 1)
}

main().catch((err) => {
  console.error(`${C.red}Fatal error:${C.reset}`, err)
  process.exit(1)
})
