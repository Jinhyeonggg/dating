# 시나리오 시스템 재설계 — Design Spec

> **Date**: 2026-04-13
> **Status**: Approved
> **Goal**: 관계 단계(자동) + 대화 분위기(유저 선택) 분리. 클론의 누적 기억과 시나리오 간 모순 제거.

---

## 배경

클론이 대화 기억을 누적하게 되면서, 기존 시나리오("온라인 첫 매칭", "친구의 친구")가 모순을 일으킨다. 2번째 대화인데 "처음 만남" 시나리오가 적용되는 상황. 기존 시나리오가 **관계 단계**(몇 번 만났는지)와 **대화 분위기**(어떤 톤으로 대화할지)를 혼합하고 있어서 발생하는 문제.

## 핵심 변경

기존 `DEFAULT_SCENARIOS` (관계+분위기 혼합 3개) → `RELATIONSHIP_STAGES` (자동) + `CONVERSATION_MOODS` (유저 선택) 분리.

---

## 1. 관계 단계 — 자동, deterministic

`clone_relationships`의 `interaction_count`로 코드가 결정. AI 판단 아님.

```ts
const RELATIONSHIP_STAGES = [
  { id: 'first-meeting', label: '처음 만나는 사이', minCount: 0, maxCount: 0 },
  { id: 'early-acquaintance', label: '몇 번 대화해 본 사이', minCount: 1, maxCount: 2 },
  { id: 'familiar', label: '여러 번 대화한 사이', minCount: 3, maxCount: Infinity },
] as const

function getRelationshipStage(interactionCount: number): { id: string; label: string }
```

- 관계가 없는 경우 (첫 대화) → `interaction_count = 0` → `first-meeting`
- 유저에게 노출하지 않음. 엔진이 내부적으로 사용.
- interaction 생성 시 API가 `clone_relationships` 조회하여 결정, `interactions.metadata.relationshipStage`에 저장.

## 2. 대화 분위기 — 유저 선택

기존 `DEFAULT_SCENARIOS` 교체:

```ts
const CONVERSATION_MOODS = [
  { id: 'casual', label: '가벼운 대화', description: '일상적이고 편한 분위기' },
  { id: 'serious', label: '진지한 대화', description: '가치관, 인생관을 나누는 분위기' },
  { id: 'free', label: '자유 대화', description: '제한 없이 자연스럽게' },
] as const
```

- 유저가 Interaction 생성 시 카드로 선택
- 대화 주제는 설정하지 않음. 클론의 persona + 기억 + 랜덤성으로 자연 형성.

## 3. 첫 메시지 프롬프트

`buildFirstUserMessage` 변경:

기존:
```
(상황 설정: 프로필 매칭 플랫폼에서 대화를 시작합니다.
시나리오: 온라인 대화 앱에서 처음 매칭됨 — 둘 다 상대방을 오늘 처음 봄.
...
```

변경:
```
(상황 설정: 프로필 매칭 플랫폼에서 대화를 시작합니다.
관계: 처음 만나는 사이.
분위기: 가벼운 대화 — 일상적이고 편한 분위기.
...
```

`buildFirstUserMessage` 인터페이스 변경:
- 기존: `scenarioLabel`, `scenarioDescription`
- 변경: `relationshipStageLabel`, `moodLabel`, `moodDescription`

## 4. 변경 파일 목록

| 파일 | 변경 |
|---|---|
| `lib/config/interaction.ts` | `DEFAULT_SCENARIOS` → `CONVERSATION_MOODS` + `RELATIONSHIP_STAGES` + `getRelationshipStage()` |
| `lib/prompts/interaction.ts` | `FirstUserMessageInput` 인터페이스 변경 + `buildFirstUserMessage` 변경 |
| `lib/prompts/interaction.test.ts` | 테스트 업데이트 |
| `components/interaction/ScenarioPicker.tsx` | → `MoodPicker.tsx`로 rename. `CONVERSATION_MOODS` 사용 |
| `app/interactions/new/page.tsx` | `ScenarioPicker` → `MoodPicker` 교체, prop명 변경 |
| `lib/validation/interaction.ts` | `scenarioId` → `moodId` 스키마 변경 |
| `app/api/interactions/route.ts` | POST: 관계 단계 조회 + `metadata`에 `{ moodId, relationshipStage }` 저장. `scenario` 컬럼에 분위기 label 저장 |
| `app/api/interactions/[id]/run/route.ts` | 관계 단계를 `buildFirstUserMessage`에 전달 |
| `lib/interaction/engine.ts` | `buildFirstUserMessage` 호출부 인터페이스 맞춤 |
| `app/interactions/page.tsx` | 목록 표시에서 scenario label 참조 변경 (있으면) |
| `components/interaction/InteractionViewer.tsx` | scenario 표시 변경 (있으면) |

## 5. DB 변경

없음.
- `interactions.scenario` 컬럼: 기존 시나리오 label → 분위기 label 저장. 용도 동일 (표시용).
- `interactions.metadata`: 기존 `{ scenarioId }` → `{ moodId, relationshipStage }`. JSON이므로 스키마 변경 불필요.
- 기존 interaction 데이터: `metadata.scenarioId`가 남아있으나 조회 전용이므로 문제없음.

## 6. 하위호환

- 기존 interaction의 `metadata.scenarioId` → 읽기 전용, 새 코드에서는 무시
- `interactions.scenario` 컬럼의 기존 값("온라인 대화 앱에서 처음 매칭됨" 등)은 뷰어에서 그대로 표시
- `DEFAULT_SCENARIOS` export 제거 → import하는 곳 모두 `CONVERSATION_MOODS`로 교체

## 7. 범위 밖

- 시나리오 커스텀 (유저가 직접 만드는 시나리오)
- 관계 단계별 행동 규칙 차이 (예: 친해진 사이면 반말 허용) — 향후 behavior 프롬프트에서 확장
- 관계 단계를 UI에 표시
