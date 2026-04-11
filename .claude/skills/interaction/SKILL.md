---
name: interaction
description: Clone 간 상호작용(Interaction) 엔진을 설계·구현·디버깅할 때 사용. Claude stateless 멀티콜, role 재매핑, 턴 관리, Realtime 스트리밍, 호환성 분석 파이프라인을 다룬다. `/api/interactions`, `/api/analyses` 작업 시 참조.
---

# Interaction Engine

Clone들 간의 상호작용을 실행하는 엔진. 1:1은 특수 케이스이며, 코드는 n-to-n으로 확장 가능하도록 설계한다.

**도메인 용어 원칙**: "Simulation", "Date", "소개팅" 같은 용어를 코드/스키마에 하드코딩하지 않는다. 항상 `Interaction` / `InteractionEvent`를 사용한다.

---

## 핵심 설계: Stateless 멀티콜 + Role 재매핑

Claude API는 stateless다. 매 턴마다 **발화자 관점**에서 전체 history를 재구성해 호출한다. 이게 정석이며 페르소나 오염을 방지한다.

```ts
// pseudo
async function runInteraction(
  participants: Clone[],      // 길이 2 = 1:1, 3+ = 그룹
  context: InteractionContext,
  maxTurns = 20
) {
  const events: InteractionEvent[] = []

  for (let turn = 0; turn < maxTurns; turn++) {
    const speaker = pickSpeaker(participants, turn, events)

    const messages = remapHistoryForSpeaker(events, speaker.id)
    //   speaker 발화 → role: 'assistant'
    //   타인 발화  → role: 'user' (발화자 이름을 content 접두어로)

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      system: buildSystemPrompt(speaker, recentMemories(speaker)),
      messages,
      stream: true,
    })

    const event = {
      interaction_id,
      turn_number: turn,
      speaker_clone_id: speaker.id,
      content: response.content,
      created_at: new Date(),
    }
    events.push(event)

    // Supabase INSERT → Realtime이 프론트로 자동 push
    await supabase.from('interaction_events').insert(event)

    if (shouldEnd(events, context)) break
  }
}
```

### 발화자 선정 (`pickSpeaker`)
- **1:1**: 단순 교대 (`participants[turn % 2]`)
- **그룹 (Phase 3)**: 이전 발화 내용·참여자 친밀도·턴 분포를 고려. 전용 "moderator" 프롬프트로 다음 발화자 결정 가능

### Role 재매핑 (`remapHistoryForSpeaker`)
이 단계를 빠뜨리면 클론이 상대 말투를 따라하거나 혼란에 빠진다. 필수.

```ts
function remapHistoryForSpeaker(events, speakerId) {
  return events.map(e => ({
    role: e.speaker_clone_id === speakerId ? 'assistant' : 'user',
    content: e.speaker_clone_id === speakerId
      ? e.content
      : `[${nameOf(e.speaker_clone_id)}]: ${e.content}`,  // 그룹 대비 이름 접두어
  }))
}
```

### 종료 조건 (`shouldEnd`)
- 최대 턴 도달
- LLM이 `<promise>END</promise>` 같은 종료 시그널 방출 (프롬프트에 규약 명시)
- 사용자 수동 중단
- 연속 3턴 이상 짧은 응답 (자연스러운 대화 종료)

---

## Interaction 컨텍스트

상호작용 유형·상황은 **메타데이터로** 관리. 코드 분기 최소화.

```ts
interface InteractionContext {
  id: string
  kind: string             // 'casual_chat' | 'deep_talk' | ... 자유 확장
  scenario: string         // "온라인 대화 앱에서 처음 매칭됨"
  setting: string | null   // "카페", "메시지 앱" 등 (nullable)
  max_turns: number
  metadata: Record<string, unknown>  // 확장용
}
```

system prompt에는 scenario를 **첫 user 메시지**로 주입한다 (system에 박아넣지 말 것 — 재사용성 저해).

---

## 스트리밍 전략

- **Claude 응답**: `stream: true`로 토큰 단위 스트리밍
- **프론트엔드 전달**: Supabase Realtime으로 `interaction_events` 테이블 subscribe
- **중간 상태**: 토큰 단위 스트리밍을 DB에 쓰면 오버헤드 큼 → 응답 완성 후 단일 INSERT + 프론트에서 인위적 "타이핑 중..." 연출
- **대안 (Phase 2)**: SSE 엔드포인트에서 토큰을 직접 프록시 + 완성 시 DB 저장

---

## 에러 & 중단 처리

| 상황 | 처리 |
|---|---|
| rate limit (429) | 지수 백오프 재시도 (max 3) |
| context window 초과 | 오래된 턴 요약 후 재시도 또는 강제 종료 |
| 네트워크 에러 | 해당 턴 재시도 (max 2) → 실패 시 interaction status='failed' |
| 사용자 중단 | interaction status='cancelled', 부분 events 유지 |
| 타임아웃 (Vercel 300s) | 완료된 턴까지 저장 후 "continue" 지원 |

모든 interaction에 `status`: `pending | running | completed | failed | cancelled` 관리.

---

## 호환성 분석 파이프라인

상호작용 완료 후 별도 Claude 호출로 분석 리포트 생성. 분석 결과는 **상호작용과 별개 엔티티**(Analysis)로 저장.

```
interaction.status === 'completed'
        ↓
POST /api/analyses { interaction_id }
        ↓
분석 Claude (sonnet, 비용 여유 있을 때 / haiku로 대체 가능)
        ↓
{
  score: 0-100,
  categories: {
    conversation_flow: { score, comment },
    shared_interests:  { score, comment },
    values_alignment:  { score, comment },
    communication_fit: { score, comment },
    potential_conflicts: [...]
  },
  summary: "...",
  recommended_next: "continue" | "pause" | "end"
}
        ↓
analyses INSERT
```

### 프롬프트 구성
- 입력: 전체 interaction_events + 양쪽 persona core 요약
- 출력: JSON 강제 (tool use 또는 structured output)
- 카테고리 목록은 `lib/constants/analysis.ts`에 상수로, 프롬프트 템플릿에서 반복적으로 주입

---

## 설정값 (하드코딩 금지)

`frontend/src/lib/config/interaction.ts`:
```ts
export const INTERACTION_DEFAULTS = {
  MAX_TURNS: 20,
  MEMORY_INJECTION_LIMIT: 10,
  RETRY_MAX: 3,
  MODEL_INTERACTION: 'claude-sonnet-4-6',
  MODEL_EXTRACTION: 'claude-haiku-4-5-20251001',
  MODEL_ANALYSIS: 'claude-sonnet-4-6',
} as const
```

---

## 관련 파일 (Phase 1 이후 예정 경로)

- `frontend/src/types/interaction.ts` — Interaction / InteractionEvent / Analysis 타입
- `frontend/src/lib/interaction/engine.ts` — 턴 루프, role 재매핑
- `frontend/src/lib/interaction/speaker.ts` — 발화자 선정 전략
- `frontend/src/lib/prompts/interaction.ts` — scenario/context 템플릿
- `frontend/src/lib/prompts/analysis.ts` — 호환성 분석 프롬프트
- `frontend/src/lib/config/interaction.ts` — 설정 상수
- `frontend/src/app/api/interactions/` — Interaction 실행 API
- `frontend/src/app/api/analyses/` — 분석 API
- `frontend/src/components/interaction/` — 대화 뷰어, 메시지 버블
