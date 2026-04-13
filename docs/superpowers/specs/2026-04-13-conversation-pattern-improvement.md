# 클론 대화 패턴 개선 — Design Spec

> **Date**: 2026-04-13
> **Status**: Approved
> **Goal**: 존댓말/반말 관계별 제어 + 전문용어/기억 과의존 방지 프롬프트 규칙

---

## 배경

1. 클론이 전문용어를 상대 수준 고려 없이 사용 (예: 필라테스 강사에게 "파이프라인 해저드")
2. 현재 맥락과 무관한 기억을 뜬금없이 꺼냄 (기억 3개를 한 턴에 쏟아내기)
3. 존댓말/반말이 관계별로 달라야 하는데 현재 페르소나 고정값만 참조

## 1. 존댓말/반말 시스템

### DB 변경

`clone_relationships`에 `speech_register` 컬럼 추가:

```sql
alter table clone_relationships
  add column speech_register text default null;
```

값: `'formal'` | `'casual'` | `'banmal-ready'` | `null` (미결정)

### 초기값 자동 결정 — `getSpeechRegister()`

코드에서 deterministic 결정. `clone_relationships.speech_register`가 null일 때만 호출.

```
- 나이 차이 5살+ → 'formal'
- 나이 차이 4살 이내 & interaction_count === 0 → 'banmal-ready'
- 나이 차이 4살 이내 & interaction_count >= 3 → 'casual'
- 나이 정보 없음 → 'banmal-ready' (기본값)
```

결정 후 DB에 저장하여 다음 대화에서 재사용.

### 대화 중 전환 — `<banmal-switch/>`

- `banmal-ready` 상태일 때, AI가 "말 놓을까요? ㅋㅋ" 류의 발화 시 `<banmal-switch/>` 태그 출력
- 기존 `<continue/>` / `<end/>` 태그 파싱과 동일 패턴
- 엔진이 파싱 → `clone_relationships` 양방향 모두 `speech_register = 'casual'`로 즉시 업데이트
- 이후 턴부터 반말 적용

### 프롬프트 주입

system prompt에 관계 기억과 함께 말투 상태 주입:

```
[말투: 존댓말 사용 (반말 전환 가능 — 자연스러운 타이밍에 "말 놓을까요?" 시도 가능)]
```

또는:

```
[말투: 반말 사용]
```

## 2. behavior.ts 프롬프트 추가 규칙

### 상대에 맞춘 언어 수준

```
**상대에 맞춘 언어 수준**
- 상대방의 직업·배경을 고려해서 말하세요. 상대가 같은 분야가 아니면 전문 용어를 쓰지 말고 일상 언어로 바꾸세요.
- 나쁜 예: "파이프라인 해저드 때문에 망했어" ← 상대가 CS 전공 아님
- 좋은 예: "좀 어려운 문제가 있어서 망한 것 같아 ㅋㅋ"
- 상대가 같은 분야 사람이거나, 먼저 전문적 이야기를 꺼내면 그때 맞춰서 깊게 가도 됩니다.
```

### 기억 활용 원칙

```
**기억 활용 원칙**
- 이전 대화 기억은 참고 자료이지 대화 스크립트가 아닙니다.
- 기억은 현재 대화 흐름에 자연스럽게 연결될 때만 꺼내세요. 상대가 관련 주제를 먼저 꺼내거나, 맥락상 자연스러울 때만.
- 알고 있는 모든 걸 대화에서 언급할 필요 없습니다. 실제 사람도 그렇게 하지 않습니다.
- 나쁜 예: (상대가 "오늘 뭐 했어?" → "파이프라인 해저드 공부했는데 너 번아웃은 좀 나아졌어? 지난번에 오후 3시에 일어난다고 했잖아") ← 기억 3개를 한번에 쏟아냄
- 좋은 예: (상대가 "오늘 뭐 했어?" → "공부 좀 했어 ㅋㅋ 너는?") ← 상대 반응 보고 자연스럽게 이어감
```

### 존댓말/반말 규칙

```
**말투 (존댓말/반말)**
- system prompt에 [말투: ...] 지시가 있습니다. 반드시 따르세요.
- '존댓말 사용': 존댓말을 유지하세요.
- '존댓말 사용 (반말 전환 가능)': 존댓말로 시작하되, 대화가 충분히 편해졌다고 느끼면 자연스럽게 "우리 말 편하게 할까요? ㅋㅋ" 같은 제안을 해도 됩니다. 제안할 때 메시지 끝에 <banmal-switch/>를 붙이세요.
- '반말 사용': 반말을 사용하세요.
- <banmal-switch/>는 한 대화에서 한 번만. 상대가 응하든 말든 이후 태그를 반복하지 마세요.
```

## 3. 변경 파일

| 파일 | 변경 |
|---|---|
| 마이그레이션 | `clone_relationships`에 `speech_register` 컬럼 추가 |
| `lib/config/interaction.ts` | `SPEECH_REGISTERS` 상수 + `getSpeechRegister()` 함수 |
| `lib/prompts/behavior.ts` | 3개 규칙 추가 (언어 수준, 기억 활용, 말투) |
| `lib/prompts/persona.ts` | `renderSpeechRegister()` 함수 — 말투 프롬프트 렌더 |
| `lib/interaction/orchestrate.ts` | 관계에서 `speech_register` 읽기, null이면 자동 결정 + DB 저장, prompt에 주입 |
| `lib/interaction/engine.ts` | `<banmal-switch/>` 태그 파싱 + DB 양방향 업데이트 |
| `types/relationship.ts` | `CloneRelationship`에 `speech_register` 필드 추가 |

## 4. 범위 밖

- 사투리 처리
- 유저가 말투를 수동 설정하는 UI
- 존칭 ("형", "누나" 등) 자동 결정
- 인터넷 캐주얼 ("~~함?", "~~임") 자동 감지 — 추후 `communication_style`에서 힌트 추출 가능
