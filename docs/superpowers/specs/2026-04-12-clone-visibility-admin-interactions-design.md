# Clone 공개/상호작용 + Admin Interactions 설계

> **상태**: Approved (2026-04-12)
> **범위**: 유저 간 Clone 공개 + 필드별 공개 제어 + Admin interactions 대시보드

---

## 1. 목표

1. 다른 유저가 생성한 Clone을 열람하고 Interaction 상대로 선택할 수 있게 한다
2. Clone 소유자가 공개 여부와 공개 필드를 세밀하게 제어한다
3. 관리자가 모든 Interaction을 조회/삭제할 수 있는 대시보드를 제공한다

---

## 2. 데이터 모델 변경

### `clones` 테이블 컬럼 추가

```sql
alter table clones add column is_public boolean not null default true;
alter table clones add column public_fields text[] not null default '{name,age,gender,occupation,mbti,personality_traits,hobbies,tags,self_description}';
```

- `is_public`: 전체 공개/비공개 토글. 기본 공개.
- `public_fields`: 다른 유저에게 노출되는 persona 필드 목록. 유저가 필드별로 커스텀 가능.

### 기본 공개 필드 상수 (코드)

```ts
export const DEFAULT_PUBLIC_FIELDS = [
  'name', 'age', 'gender', 'occupation',
  'mbti', 'personality_traits',
  'hobbies', 'tags',
  'self_description',
] as const
```

이 상수는 `public_fields` 컬럼의 **기본값**으로만 사용. 실제 필터링은 clone별 `public_fields` 컬럼 기준.

### RLS 변경

`clones` select 정책 확장:
- 기존: 내 것 (`user_id = auth.uid()`) + NPC (`is_npc = true`)
- 변경: 내 것 + NPC + **`is_public = true`인 다른 유저 것**

Column masking은 RLS로 불가 → API 레이어에서 `persona_json` 필드 필터링.

### 새 테이블 없음

---

## 3. API 변경

### `GET /api/clones`

현재: 내 Clone + NPC 반환.
변경: 3그룹으로 구분된 응답.

```ts
{
  mine: Clone[],          // 내 Clone (전체 persona)
  community: Clone[],     // 다른 유저의 is_public=true (public_fields만)
  npc: Clone[],           // NPC (전체 persona)
}
```

커뮤니티 Clone의 `persona_json`은 서버에서 해당 clone의 `public_fields`에 포함된 키만 남기고 나머지 strip.

### `GET /api/clones/[id]`

- 본인 Clone / NPC → 전체 persona (기존 동일)
- 다른 유저의 공개 Clone → `public_fields`만 포함된 persona 반환
- 다른 유저의 비공개 Clone → 404

### `PATCH /api/clones/[id]`

기존 persona 업데이트에 추가:
- `is_public` boolean 토글 허용
- `public_fields` string[] 업데이트 허용
- 본인 것만 수정 가능 (기존 로직)

---

## 4. 페이지 변경

### `/clones` — 3섹션 레이아웃

순서: **내 Clone → 커뮤니티 Clone → NPC**

- 각 섹션에 제목 ("내 Clone", "커뮤니티", "NPC")
- 커뮤니티 Clone 카드: 공개 필드만 표시 + "커뮤니티" 뱃지
- 커뮤니티 섹션이 비어 있으면 "아직 공개된 Clone이 없습니다" placeholder

### `/clones/[id]` — 타인 Clone 상세

- 다른 유저의 공개 Clone 접근 가능
- 공개 필드만 표시
- 비공개 필드는 표시하지 않음 (영역 자체 생략)
- 편집 버튼 없음 (본인 것이 아니면)

### `/clones/[id]/edit` — 공개 제어 추가

- **상단**: `is_public` 토글 스위치 ("다른 유저에게 공개")
  - `is_public=false`이면 자물쇠 아이콘들 전체 비활성화 (어차피 전부 비공개)
- **각 필드 라벨 옆**: 작은 자물쇠 아이콘 (🔒비공개 / 🔓공개)
  - 클릭 → `public_fields` 배열에서 해당 필드 추가/제거
  - 편집 페이지에서만 보임 (열람 페이지에서는 숨김)
  - `is_public=false`이면 전체 disabled 처리

### `/interactions/new` — pair picker 확장

- 기존 "내 Clone + NPC" → "내 Clone + 커뮤니티 + NPC" 순
- 각 Clone 카드에 뱃지: 내 것 / 커뮤니티 / NPC
- `/clones` 페이지와 동일한 순서

---

## 5. Admin Interactions 대시보드

### `/admin/interactions` (신규)

- 기존 `/admin` layout 재사용 (ADMIN_USER_IDS env var 기반 접근 제어)
- 모든 유저의 Interaction 목록 표시
- 각 행: Clone A 이름 × Clone B 이름, 상태 (pending/running/completed/failed), 턴 수, 생성일
- 클릭 → 기존 `/interactions/[id]` 뷰어로 이동
- 삭제 버튼 (확인 dialog)

### API

- `GET /api/admin/interactions` — admin only. 전체 interaction 목록 (participants join)
- `DELETE /api/admin/interactions/[id]` — admin only. interaction + cascade 삭제

---

## 6. 변경 파일 요약

### DB
- 마이그레이션: `clones`에 `is_public`, `public_fields` 컬럼 추가 + RLS 수정

### API (수정)
- `GET /api/clones` — 3그룹 응답 + persona 필터링
- `GET /api/clones/[id]` — 타인 Clone persona 필터링
- `PATCH /api/clones/[id]` — is_public, public_fields 업데이트

### API (신규)
- `GET /api/admin/interactions`
- `DELETE /api/admin/interactions/[id]`

### 페이지 (수정)
- `/clones` — 3섹션 레이아웃
- `/clones/[id]` — 타인 Clone 공개 필드만 표시
- `/clones/[id]/edit` — is_public 토글 + 필드별 자물쇠

### 페이지 (신규)
- `/admin/interactions`

### 코드
- `lib/constants/publicFields.ts` — DEFAULT_PUBLIC_FIELDS 상수
- `lib/clone/filter.ts` — persona 필드 필터링 순수 함수
- `lib/validation/clone.ts` 수정 — is_public, public_fields 스키마 추가

---

## 7. Interaction 시 persona 사용 규칙

- Interaction 엔진은 **항상 전체 persona_json 사용** (public_fields 무시)
- 공개 필드 필터링은 **열람 API에서만** 적용
- 즉, Clone A(유저1)와 Clone B(유저2)가 대화할 때 양쪽 모두 전체 persona로 시뮬레이션. 유저2가 Clone A의 비공개 필드를 직접 볼 수는 없지만, AI가 대화에 반영하는 건 OK

---

## 8. 승인 상태

- [x] 프라이버시 모델 — 기본 공개 + opt-out + 필드별 제어
- [x] 공개 필드 기본값 9개
- [x] `/clones` 3섹션 순서: 내 Clone → 커뮤니티 → NPC
- [x] pair picker에 커뮤니티 추가, 뱃지 구분
- [x] 편집 페이지 필드별 자물쇠 UI
- [x] `/admin/interactions` 조회 + 삭제
- [x] 유저 전체 스펙 리뷰 — **pending**
