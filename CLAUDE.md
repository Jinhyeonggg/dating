# Dating Clone Simulation — Project Guide

## 프로젝트 개요

사용자의 디지털 클론(AI 페르소나)을 만들어 클론끼리 소개팅 시뮬레이션을 수행하는 서비스.
서로의 스타일 궁합을 사전 검증 후 실제 매칭을 추천하는 것이 핵심 목적.

**현재 단계**: 프로토타입 — 사용자가 직접 입력한 페르소나 기반 (실제 SNS 데이터 연동은 v2)

---

## 기술 스택

### Frontend + API
- **Framework**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **상태관리**: useState / useContext (React 기본)
- **Claude API 호출**: Next.js API Routes (`/api/*`)
- **LLM**: Anthropic Claude API (`claude-sonnet-4-6` 기본, 비용 최적화 시 `claude-haiku-4-5-20251001`)

### Backend (Supabase)
- **DB**: Supabase PostgreSQL
- **Auth**: Supabase Auth
- **실시간**: Supabase Realtime (시뮬레이션 스트리밍)

### AI / Simulation
- **페르소나 엔진**: 구조화된 페르소나 JSON → Claude system prompt 변환
- **시뮬레이션**: Claude API 멀티턴 대화 (두 클론이 번갈아 응답)
- **궁합 분석**: 시뮬레이션 대화 로그 → 별도 분석 Claude 호출

### 인프라
- **배포**: Vercel (Next.js)

---

## 프로젝트 구조

```
dating/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/          # Next.js API Routes (Claude API 호출)
│   │   │   │   ├── simulate/ # 시뮬레이션 엔드포인트
│   │   │   │   └── analyze/  # 궁합 분석 엔드포인트
│   │   │   └── (pages)
│   │   ├── components/
│   │   ├── lib/
│   │   │   ├── supabase.ts   # Supabase 클라이언트
│   │   │   └── prompts/      # Claude 프롬프트 템플릿
│   │   └── types/
│   ├── .env.local.example
│   └── package.json
├── docs/
│   └── RESEARCH.md
└── CLAUDE.md
```

---

## 코딩 규칙

### 공통
- 커밋 메시지: `feat:`, `fix:`, `refactor:`, `docs:`, `test:` 접두사
- 모든 환경변수는 `.env` 파일 관리, `.env.example` 유지
- API 키/비밀키 코드 하드코딩 금지

### TypeScript (Frontend)
- `strict: true` 모드
- `any` 타입 사용 금지
- 컴포넌트: 함수형만, `'use client'` 최소화
- 파일명: 컴포넌트 PascalCase, 유틸 camelCase

### Claude API 사용
- 프롬프트 템플릿은 `backend/app/prompts/`에 별도 파일로 관리
- 시뮬레이션 대화 최대 20턴 제한 (토큰 비용 + 현실감)
- 스트리밍 응답 활용 (UX 개선)
- rate limit, context window 초과 에러 핸들링 필수

---

## 페르소나 스키마

```json
{
  "name": "김지수",
  "age": 28,
  "gender": "여성",
  "occupation": "UX 디자이너",
  "mbti": "INFJ",
  "interests": ["독서", "요가", "영화감상", "카페 탐방"],
  "values": ["진정성", "배려", "성장"],
  "dealbreakers": ["흡연", "무례한 언행"],
  "communication_style": "초반엔 조심스럽지만 친해지면 솔직해짐. 유머 좋아함.",
  "relationship_goal": "진지한 연애",
  "self_description": "조용하지만 호기심이 많고, 깊은 대화를 선호함."
}
```

---

## 시뮬레이션 파이프라인

```
1. 페르소나 A, B 입력
        ↓
2. 각 페르소나 → Claude system prompt 생성 (clone.py)
        ↓
3. 소개팅 시나리오 설정 (카페, 첫 만남 등)
        ↓
4. 멀티턴 대화 시뮬레이션 (simulation.py)
   - Clone A 발화 → Clone B 응답 반복
   - 최대 20턴
        ↓
5. 대화 로그 → 궁합 분석 (analysis.py)
   - 대화 몰입도, 공통 관심사, 가치관 충돌, 유머 코드
        ↓
6. 궁합 점수 (0-100) + 분석 리포트
```

---

## 주요 의사결정 기록

| 결정 | 이유 |
|------|------|
| Next.js API Routes (FastAPI 제거) | 별도 서버 불필요, Vercel 단일 배포, 프로토타입 단순성 |
| Supabase (SQLite 제거) | managed DB + Auth + Realtime 내장, 설정 최소화 |
| 클론당 별도 Claude 호출 | stateless 설계로 확장 용이, 컨텍스트 분리로 페르소나 오염 방지 |
| 시뮬레이션 20턴 제한 | 토큰 비용 제어 + 소개팅 현실감 |
| Next.js App Router | 서버 컴포넌트로 초기 로딩 최적화, 스트리밍 UI 지원 |

---

## 개발 단계

### Phase 1 (프로토타입 코어)
- 페르소나 입력 → 클론 생성 API
- 시뮬레이션 엔진 (백엔드)
- 기본 UI (입력 폼 + 시뮬레이션 뷰어)

### Phase 2 (UX 개선)
- 실시간 스트리밍 시뮬레이션 (WebSocket 또는 SSE)
- 궁합 분석 리포트 시각화
- 여러 후보와 배치 시뮬레이션

### Phase 3 (데이터 연동 — v2)
- 카카오톡 대화 데이터 파서
- 인스타그램 활동 데이터 파서
- 실제 데이터 기반 페르소나 자동 생성
