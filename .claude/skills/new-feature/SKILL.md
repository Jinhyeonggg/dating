---
name: new-feature
description: 새 기능을 구현할 때 사용. 백엔드 API 엔드포인트 + 프론트엔드 컴포넌트를 함께 구현하는 전체 플로우를 안내한다.
disable-model-invocation: true
argument-hint: <feature-description>
allowed-tools: Read Grep Bash(find *) Bash(ls *)
---

# 새 기능 구현 플로우

구현할 기능: $ARGUMENTS

## 구현 순서 (반드시 이 순서대로)

### 1. 백엔드 스키마 (backend/app/schemas/)
```python
# 요청/응답 Pydantic 모델 먼저 정의
class FeatureRequest(BaseModel): ...
class FeatureResponse(BaseModel): ...
```

### 2. 백엔드 서비스 (backend/app/services/)
```python
# 비즈니스 로직 구현, Claude API 호출 포함
async def feature_service(request: FeatureRequest) -> FeatureResponse: ...
```

### 3. 백엔드 API 라우터 (backend/app/api/)
```python
# FastAPI 라우터 — 서비스 레이어 호출만
@router.post("/feature", response_model=FeatureResponse)
async def feature_endpoint(request: FeatureRequest): ...
```

### 4. 타입 정의 (frontend/src/types/)
```typescript
// 백엔드 스키마와 1:1 매핑
interface FeatureRequest { ... }
interface FeatureResponse { ... }
```

### 5. API 클라이언트 (frontend/src/lib/api.ts)
```typescript
export const featureApi = {
  execute: (request: FeatureRequest) => axios.post<FeatureResponse>('/api/feature', request)
}
```

### 6. React 컴포넌트 (frontend/src/components/)
```tsx
// TanStack Query 훅으로 API 호출
const { mutate, isPending } = useMutation({ mutationFn: featureApi.execute })
```

## 체크리스트
- [ ] Pydantic 모델에 Field 검증 추가
- [ ] API 엔드포인트에 HTTP 에러 처리
- [ ] TypeScript `any` 타입 없음
- [ ] 로딩/에러 상태 UI 처리
- [ ] .env.example에 새 환경변수 추가 (있다면)
