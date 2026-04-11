# 유사/인접 플랫폼 리서치

본 프로젝트 비전(AI 클론끼리 자동 대화 → 호환성 탐색 → 실제 매칭 추천 → n-to-n 메타버스)과 관련된 기존 플랫폼을 4개 범주로 정리.

---

## 1. 직접 경쟁자 — AI 클론 기반 데이팅

### Ditto (ditto.ai) — **가장 직접적인 경쟁자**

UC Berkeley 중퇴 팀, 2026년 $9.2M 시드 조달. 컨셉이 본 프로젝트와 거의 동일.

**동작 방식**
- 프로필 입력 → AI가 두 페르소나로 **1,000번 데이트 시뮬레이션** → 주 1회 최적 매치 제안
- 파이프라인: 분석 에이전트(이미지/성격 태깅) → 매칭 에이전트(vibe check, hobby match) → 시뮬레이션 에이전트(첫인상, 대화 흐름 평가)
- 현재 대학(`.edu`) 계정 한정, campus-first 전략
- 단순 폼 입력 기반, 실제 SNS 데이터 미활용

**한계 (본 프로젝트가 보완할 지점)**
- **시뮬레이션 과정 블랙박스** — 사용자가 클론 간 대화를 직접 볼 수 없음
- 주 1회 매치만 제공 (제한적)
- 영어 중심, 한국 시장 미진출
- 풍부한 페르소나 스키마 없음 (단순 프로필)
- 에피소드 메모리 갱신 기능 없음

**시사점**: 본 프로젝트는 **투명성(사용자가 대화 관찰 가능)** + **풍부한 페르소나 스키마** + **n-to-n 확장** + **한국 시장 특화**로 차별화 가능.

### Volar (2023 런칭 → 2024 서비스 종료)

Volar는 AI 챗봇에 프로필을 학습시킨 뒤 다른 봇들과 "blind date"를 돌리는 컨셉. 10-메시지 짧은 교환으로 호환성 감지. **2024년 자금난으로 crash**.

**교훈**
- 컨셉 자체는 검증됨 (언론 주목, 초기 유저 확보 가능)
- 10 메시지는 너무 짧았을 가능성 (본 프로젝트의 20턴이 더 적절)
- **비즈니스 모델·수익화 설계가 생존을 결정** → Phase 5 전에 수익 모델 검증 필요

### Teaser AI

"디지털 트윈 챗봇" 최초 표방. 스와이프 전에 **상대의 AI 복제본과 먼저 대화** 가능. 가입 시 성격 문답 + 사용 중 말투 학습으로 개인화. 정적 프로필 → AI 영상 인트로 변환 기능도 제공.

**단방향**: 상대 클론과 내가 대화, 클론끼리 자동 대화는 아님 → 본 프로젝트가 한 단계 위.

### Iris Dating

심리 테스트 + **내가 스와이프한 사진을 분석**해 AI가 "내 타입"을 학습, 매칭 추천. 클론 개념은 없고 **취향 학습 + 매칭 알고리즘** 쪽.

### SciMatch

얼굴 스캔으로 성격 예측 → 궁합 점수 계산. 5분 영상 스피드 데이트 제공. 기술적으로는 미심쩍음(얼굴로 성격 예측)이지만 **"미팅 전 사전 검증"** 니즈는 동일.

---

## 2. 인접 — AI 컴패니언 / 대화 시뮬레이터

### Blush.ai (Luka, Replika 제작사)

**데이팅 스킬 연습용** AI 시뮬레이터. 다양한 성격의 가상 상대와 대화하며 연애 기술을 학습. **평가 없는 안전한 연습 공간**이 포지셔닝. 실제 매칭은 아님.

**시사점**: 본 프로젝트의 NPC 5종 seed와 UX 철학이 유사. "다양한 상대와 먼저 연습"이라는 가치 제안이 이미 시장 검증.

### Keeper.ai

유료 AI 매치메이커. 인간 매치메이커를 AI로 대체하는 방향.

### Sitch

음성 AI 매치메이커.

### Replika, Character.AI, Kindroid, Nomi.ai

1:1 AI 친구·연인 역할극 (Nomi는 그룹 채팅 지원). **타 사용자와 간접 연결** 기능 없음 — 개인 챗봇에 머무름.

---

## 3. 디지털 클론 플랫폼 (비데이팅)

### Delphi.ai — 가장 성숙한 디지털 클론 플랫폼

PDF·비디오·팟캐스트로부터 사용자의 **지식·말투·전문성**을 복제. Deepak Chopra, Brendon Burchard 등 셀럽의 클론을 상업화 중. 웹/SMS/WhatsApp/Slack/Zoom에 배포. 1시간 내에 한 사람을 복제.

**포지셔닝**: B2B 지식 노동자·크리에이터 대상, "나를 확장" 용도. 관계/매칭이 아님.

**시사점**
- "PDF·비디오로부터 페르소나 자동 생성"은 Phase 4의 **카카오톡/인스타 파서**와 유사 기술 — 참고 가능
- Delphi가 이미 한 사람을 1시간 내에 복제할 수 있다는 건 기술적 실현 가능성 근거

### Personal.ai

개인의 메모·대화·활동을 학습해 **"개인용 AI"** 를 만드는 방향. Delphi와 유사하나 더 개인 지식 베이스 성격. 역시 매칭 용도 아님.

---

## 4. 학술 기반 — **Stanford Smallville (가장 중요한 선행 연구)**

**논문**: "Generative Agents: Interactive Simulacra of Human Behavior" (Park et al., 2023, UIST)

25개의 LLM 기반 에이전트를 Sims 스타일 마을에 배치해 **자율 상호작용**을 시뮬레이션.

**각 에이전트 구성**
- **짧은 바이오** (이름·나이·직업·가족·관심사·습관) — 본 프로젝트의 `persona_json`과 개념적으로 동일
- **기억·반성·계획 모듈**로 경험 누적 — 본 프로젝트의 `clone_memories` + Phase 5 자율 에이전트 방향과 일치
- **서로 대화하고 관계 형성** — 본 프로젝트의 Phase 3 n-to-n 비전

**핵심 발견**: 크라우드워커들이 **에이전트 응답을 실제 인간(역할 연기)의 응답보다 더 믿을 만하다**고 평가. → LLM이 페르소나를 일관되게 유지할 수 있다는 강력한 증거.

**시사점**
- **본 프로젝트의 Phase 3-5 비전은 학술적으로 이미 가능성이 입증됨**
- 오픈소스: [joonspk-research/generative_agents](https://github.com/joonspk-research/generative_agents) — 기억 retrieval, 계획, 반성 루프 구조 참고
- `nmatter1/smallville` — 게임 NPC용 포팅

---

## 포지셔닝 맵

```
               n-to-n 자율 상호작용
                        ▲
                        │
   Stanford Smallville ●│
   (학술, 비상용)        │
                        │● 본 프로젝트 비전 (Phase 3-5)
                        │
   Delphi ●────────────●│● 본 프로젝트 Phase 1-2
   (1 클론, B2B)         │
                        │● Ditto (최근접 경쟁자)
                        │● Volar (실패)
                        │● Teaser (상대 클론과 대화)
                        │● Blush (연습용 NPC)
                        │
                        │● Replika, Character.AI, Nomi
                        │  (1:1 컴패니언)
  ──────────────────────┼──────────────────► 상용화/데이팅 포커스
                      학술                  상용
```

---

## 본 프로젝트의 차별점

1. **시뮬레이션 투명성** — 사용자가 클론 간 대화를 **직접 관찰** 가능 (Ditto의 블랙박스 한계 보완)
2. **"내 클론 vs 상대 클론" 자동 대화** — Teaser는 내가 상대 클론과 대화, Volar는 클론끼리였지만 10메시지·종료. 본 프로젝트는 20턴·메모리 누적·호환성 분석까지
3. **풍부한 페르소나 스키마** (50+ 필드, null 허용) — 대부분 경쟁자는 단순 프로필/태그 수준
4. **에피소드 메모리 누적** — 클론이 "지난주에 한 일"을 기억한 채 대화. Delphi/Smallville이 공유하는 방향이지만 데이팅 맥락엔 아직 없음
5. **n-to-n 메타버스 비전** — Smallville을 상용 매칭 플랫폼에 적용하는 건 아직 없음
6. **한국 시장 특화** — 카카오 생태계 연동, 한국어 뉘앙스 최적화 (Phase 4)
7. **SNS 데이터 기반 클론** (Phase 4) — 카카오톡·인스타 데이터로 실제 언어 패턴 재현

---

## 리스크 경고

- **Volar 사례**: 컨셉은 맞았어도 **수익화 실패**. Phase 2 말 쯤엔 "사용자가 돈 낼 이유" (프리미엄 분석, 무제한 NPC, 실제 매칭 소개)를 구체화 필요
- **신뢰 리스크**: 여성 응답자의 10%만 AI 데이팅을 긍정 평가 (남성 20%). **"감시가 아닌 도구"** 메시지가 중요 — 클론은 나를 대신하는 게 아니라 나를 **보호**한다는 프레이밍
- **프라이버시**: 카카오톡·인스타 데이터 파싱(Phase 4)은 규제·신뢰 이슈 큼. 수집 범위·보관 기간·옵트아웃을 제품 설계 단계부터 명시
- **Ditto 선점 리스크**: 자본·팀이 더 큼. 본 프로젝트는 **차별화 포인트**(투명성, 풍부 스키마, 한국, n-to-n)에 집중해야 함

---

## 참고 링크

### 직접 경쟁자
- [Ditto — get a date every wednesday](https://ditto.ai/)
- [Ditto $9.2M 시드 피치덱 분석 (DNYUZ)](https://dnyuz.com/2026/02/03/this-startup-uses-ai-to-get-you-on-a-date-fast-read-the-pitch-deck-it-used-to-raise-9-2-million/)
- [Ditto 상세 리뷰 (Medium)](https://medium.com/@liuzixuan1103/ditto-and-the-end-of-swiping-can-ai-simulate-chemistry-before-you-even-meet-dee2fdbf5795)
- [Volar review (5280 Magazine)](https://5280.com/i-tried-new-ai-dating-app-volar/)
- [Teaser's AI dating app (TechCrunch)](https://techcrunch.com/2023/06/09/teasers-ai-dating-app-turns-you-into-a-chatbot/)
- [Iris Dating](https://www.irisdating.com/)
- [SciMatch AI Dating Matchmaker](https://scimatch.com/)

### 인접
- [Blush](https://blush.ai/)
- [Keeper AI](https://www.keeper.ai)
- [AI is invading dating apps (Medium)](https://medium.com/ai-ai-oh/ai-is-invading-dating-apps-af26f4d26a35)
- [AI Dating Apps 완전 가이드 (ITRex)](https://itrexgroup.com/blog/ai-for-dating-apps/)

### 디지털 클론 플랫폼
- [Delphi — Create Your Digital Mind](https://read.unicorner.news/p/delphi)
- [How Delphi leverages AI to create digital clones (AssemblyAI)](https://www.assemblyai.com/blog/how-delphi-leverages-ai-to-create-digital-clones-of-thought-leaders)

### 학술
- [Computational Agents Exhibit Believable Humanlike Behavior (Stanford HAI)](https://hai.stanford.edu/news/computational-agents-exhibit-believable-humanlike-behavior)
- [Generative Agents paper (arXiv)](https://arxiv.org/abs/2304.03442)
- [joonspk-research/generative_agents (GitHub)](https://github.com/joonspk-research/generative_agents)
- [Nature: What this virtual AI village is teaching researchers](https://www.nature.com/articles/d41586-023-02818-9)
