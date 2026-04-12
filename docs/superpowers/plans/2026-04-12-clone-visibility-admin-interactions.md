# Clone Visibility & Admin Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable cross-user clone browsing with field-level privacy control, and add an admin interactions dashboard.

**Architecture:** Add `is_public` + `public_fields` columns to `clones`, extend RLS, filter persona at API layer. Clone list page gets 3 sections (mine → community → NPC). Admin gets a new `/admin/interactions` page for viewing/deleting all interactions.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + RLS), Tailwind CSS, shadcn/ui, Zod 4, Vitest

**Spec:** `docs/superpowers/specs/2026-04-12-clone-visibility-admin-interactions-design.md`

**Dependencies:** A→B→C→D, E is independent after A.

---

## Group A: Foundation

### Task 1: DB Migration

**Files:**
- Create: `frontend/supabase/migrations/20260412000003_clone_visibility.sql`

- [ ] **Step 1: Write migration**

```sql
-- frontend/supabase/migrations/20260412000003_clone_visibility.sql
-- Clone visibility: public/private toggle + per-field privacy control

alter table clones add column is_public boolean not null default true;
alter table clones add column public_fields text[] not null default '{name,age,gender,occupation,mbti,personality_traits,hobbies,tags,self_description}';

-- Extend RLS: allow reading other users' public clones
drop policy if exists "clones_npc_read" on clones;

create policy "clones_public_read"
  on clones for select
  to authenticated
  using (
    deleted_at is null
    and (
      is_npc = true
      or user_id = auth.uid()
      or (is_public = true and is_npc = false)
    )
  );
```

- [ ] **Step 2: Apply migration**

Run: `cd frontend && npx supabase db push`
Expected: Migration applied successfully

- [ ] **Step 3: Commit**

```bash
git add frontend/supabase/migrations/20260412000003_clone_visibility.sql
git commit -m "feat(db): add is_public + public_fields to clones, extend RLS"
```

---

### Task 2: Constants + Filter Function (TDD)

**Files:**
- Create: `frontend/src/lib/clone/publicFields.ts`
- Create: `frontend/src/lib/clone/publicFields.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// frontend/src/lib/clone/publicFields.test.ts
import { describe, it, expect } from 'vitest'
import { filterPersonaByPublicFields, DEFAULT_PUBLIC_FIELDS } from './publicFields'
import type { Persona } from '@/types/persona'

describe('DEFAULT_PUBLIC_FIELDS', () => {
  it('9개 기본 공개 필드를 포함한다', () => {
    expect(DEFAULT_PUBLIC_FIELDS).toHaveLength(9)
    expect(DEFAULT_PUBLIC_FIELDS).toContain('name')
    expect(DEFAULT_PUBLIC_FIELDS).toContain('self_description')
  })
})

describe('filterPersonaByPublicFields', () => {
  const fullPersona = {
    name: '테스트',
    age: 25,
    gender: '여성',
    occupation: '개발자',
    mbti: 'INFJ',
    personality_traits: ['조용함'],
    hobbies: ['등산'],
    tags: ['테크'],
    self_description: '안녕하세요',
    beliefs: '비공개 정보',
    past_relationships_summary: '민감한 정보',
    daily_routine: '비공개 루틴',
  } as Persona

  it('public_fields에 포함된 필드만 반환한다', () => {
    const filtered = filterPersonaByPublicFields(fullPersona, ['name', 'age', 'mbti'])
    expect(filtered.name).toBe('테스트')
    expect(filtered.age).toBe(25)
    expect(filtered.mbti).toBe('INFJ')
    expect(filtered.beliefs).toBeUndefined()
    expect(filtered.past_relationships_summary).toBeUndefined()
  })

  it('빈 public_fields면 빈 객체 반환', () => {
    const filtered = filterPersonaByPublicFields(fullPersona, [])
    expect(Object.keys(filtered)).toHaveLength(0)
  })

  it('존재하지 않는 필드는 무시', () => {
    const filtered = filterPersonaByPublicFields(fullPersona, ['name', 'nonexistent' as any])
    expect(filtered.name).toBe('테스트')
    expect(Object.keys(filtered)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests — FAIL**

Run: `cd frontend && npx vitest run src/lib/clone/publicFields.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// frontend/src/lib/clone/publicFields.ts
import type { Persona } from '@/types/persona'

export const DEFAULT_PUBLIC_FIELDS: ReadonlyArray<keyof Persona> = [
  'name',
  'age',
  'gender',
  'occupation',
  'mbti',
  'personality_traits',
  'hobbies',
  'tags',
  'self_description',
] as const

export function filterPersonaByPublicFields(
  persona: Persona,
  publicFields: string[],
): Partial<Persona> {
  const result: Record<string, unknown> = {}
  for (const field of publicFields) {
    if (field in persona) {
      result[field] = persona[field as keyof Persona]
    }
  }
  return result as Partial<Persona>
}
```

- [ ] **Step 4: Run tests — PASS**

Run: `cd frontend && npx vitest run src/lib/clone/publicFields.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/clone/publicFields.ts frontend/src/lib/clone/publicFields.test.ts
git commit -m "feat(clone): DEFAULT_PUBLIC_FIELDS + filterPersonaByPublicFields (TDD)"
```

---

### Task 3: Validation Schema Update

**Files:**
- Modify: `frontend/src/lib/validation/persona.ts`

- [ ] **Step 1: Read current updateCloneSchema**

Read `frontend/src/lib/validation/persona.ts` to find the `updateCloneSchema`.

- [ ] **Step 2: Add is_public and public_fields to updateCloneSchema**

Add to the `updateCloneSchema` z.object:

```ts
is_public: z.boolean().optional(),
public_fields: z.array(z.string()).optional(),
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/validation/persona.ts
git commit -m "feat(validation): add is_public + public_fields to updateCloneSchema"
```

---

## Group B: API Changes

### Task 4: GET /api/clones — 3-Group Response

**Files:**
- Modify: `frontend/src/app/api/clones/route.ts`

- [ ] **Step 1: Read current GET handler**

Read `frontend/src/app/api/clones/route.ts`.

- [ ] **Step 2: Modify GET handler to return 3 groups**

Change the GET handler to query three groups:
1. `mine`: user's own clones (existing query, unchanged)
2. `community`: other users' public clones — `select('*').eq('is_npc', false).eq('is_public', true).neq('user_id', user.id).is('deleted_at', null).order('created_at', { ascending: false })`
3. `npcs`: NPC clones (existing query, unchanged)

For community clones, filter persona using `filterPersonaByPublicFields`:

```ts
import { filterPersonaByPublicFields } from '@/lib/clone/publicFields'

// After fetching community clones:
const filteredCommunity = (communityRaw ?? []).map((clone) => ({
  ...clone,
  persona_json: filterPersonaByPublicFields(clone.persona_json, clone.public_fields),
}))
```

Return: `{ mine, community: filteredCommunity, npcs }`

- [ ] **Step 3: Typecheck + run tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/api/clones/route.ts
git commit -m "feat(api): GET /api/clones returns mine + community + npcs with persona filtering"
```

---

### Task 5: GET /api/clones/[id] — Persona Filtering

**Files:**
- Modify: `frontend/src/app/api/clones/[id]/route.ts`

- [ ] **Step 1: Read current GET handler**

Read `frontend/src/app/api/clones/[id]/route.ts`.

- [ ] **Step 2: Add persona filtering for non-owner clones**

After fetching the clone, check ownership. If the clone belongs to another user and is public, filter persona:

```ts
import { filterPersonaByPublicFields } from '@/lib/clone/publicFields'

// After fetching clone:
const isOwner = clone.user_id === user.id || clone.is_npc
if (!isOwner) {
  if (!clone.is_public) throw errors.notFound('Clone')
  clone.persona_json = filterPersonaByPublicFields(clone.persona_json, clone.public_fields)
}
```

Note: RLS already prevents reading private non-owned clones, but double-check at API layer.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/api/clones/[id]/route.ts
git commit -m "feat(api): filter persona for non-owner clone reads"
```

---

### Task 6: PATCH /api/clones/[id] — is_public + public_fields

**Files:**
- Modify: `frontend/src/app/api/clones/[id]/route.ts`

- [ ] **Step 1: Update PATCH handler**

In the PATCH handler, after validating with `updateCloneSchema`, include `is_public` and `public_fields` in the update object if provided:

```ts
const updateData: Record<string, unknown> = {}

if (validated.persona) {
  // existing persona merge logic...
}
if (validated.name !== undefined) updateData.name = validated.name
if (validated.is_active !== undefined) updateData.is_active = validated.is_active
if (validated.is_public !== undefined) updateData.is_public = validated.is_public
if (validated.public_fields !== undefined) updateData.public_fields = validated.public_fields
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/api/clones/[id]/route.ts
git commit -m "feat(api): PATCH clones supports is_public + public_fields update"
```

---

## Group C: Clone Pages

### Task 7: /clones Page — 3 Sections

**Files:**
- Modify: `frontend/src/app/clones/page.tsx`
- Modify: `frontend/src/components/clone/CloneList.tsx`

- [ ] **Step 1: Read current page + CloneList**

Read both files to understand current structure.

- [ ] **Step 2: Update CloneList to accept community prop**

Add `community` prop to CloneList. Render 3 sections in order: 내 Clone → 커뮤니티 Clone → NPC.

```tsx
interface CloneListProps {
  mine: Clone[]
  community: Clone[]
  npcs: Clone[]
}

export function CloneList({ mine, community, npcs }: CloneListProps) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-lg font-semibold">내 Clone</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 만든 Clone이 없습니다</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">{mine.map((c) => <CloneCard key={c.id} clone={c} badge="mine" />)}</div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">커뮤니티</h2>
        {community.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 공개된 Clone이 없습니다</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">{community.map((c) => <CloneCard key={c.id} clone={c} badge="community" />)}</div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">NPC</h2>
        <div className="grid gap-4 sm:grid-cols-2">{npcs.map((c) => <CloneCard key={c.id} clone={c} badge="npc" />)}</div>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Update clones page to fetch + pass community**

Update the page's data fetching to use the new 3-group API response, and pass `community` to CloneList.

- [ ] **Step 4: Typecheck + manual test**

Run: `cd frontend && npx tsc --noEmit`
Start dev server and verify 3 sections render on `/clones`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/clones/page.tsx frontend/src/components/clone/CloneList.tsx
git commit -m "feat(ui): /clones page with 3 sections — mine, community, NPC"
```

---

### Task 8: CloneCard + Badges

**Files:**
- Modify: `frontend/src/components/clone/CloneCard.tsx`
- Modify: `frontend/src/components/clone/CloneNpcBadge.tsx`

- [ ] **Step 1: Read current components**

Read CloneCard.tsx and CloneNpcBadge.tsx.

- [ ] **Step 2: Add badge prop to CloneCard**

Add optional `badge` prop to CloneCard: `'mine' | 'community' | 'npc'`

```tsx
interface CloneCardProps {
  clone: Clone
  badge?: 'mine' | 'community' | 'npc'
}

export function CloneCard({ clone, badge }: CloneCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{clone.name}</CardTitle>
          {badge === 'npc' && <CloneNpcBadge />}
          {badge === 'community' && <Badge variant="outline" className="text-xs">커뮤니티</Badge>}
        </div>
        {/* existing chips: age, occupation, mbti */}
      </CardHeader>
      {/* existing body */}
    </Card>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/clone/CloneCard.tsx
git commit -m "feat(ui): CloneCard supports mine/community/npc badge prop"
```

---

### Task 9: /clones/[id] — Other User View

**Files:**
- Modify: `frontend/src/app/clones/[id]/page.tsx`

- [ ] **Step 1: Read current page**

Read the clone detail page.

- [ ] **Step 2: Handle non-owner view**

The API already returns filtered persona for non-owner clones. The UI just needs to:
- Hide edit button if not owner (`clone.user_id !== currentUser.id && !clone.is_npc`)
- Display whatever fields are present in `persona_json` (filtered fields will be missing, which existing rendering handles gracefully via null checks)
- Add "커뮤니티" badge if not owner and not NPC

- [ ] **Step 3: Typecheck + manual test**

Run: `cd frontend && npx tsc --noEmit`
Test: navigate to another user's public clone detail page.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/clones/[id]/page.tsx
git commit -m "feat(ui): clone detail page handles community clone view"
```

---

### Task 10: /clones/[id]/edit — Privacy Controls

**Files:**
- Modify: `frontend/src/app/clones/[id]/edit/page.tsx`

- [ ] **Step 1: Read current edit page**

Read the clone edit page to understand current structure (tabs, field rendering).

- [ ] **Step 2: Add is_public toggle at top**

Add a toggle switch above the persona form tabs:

```tsx
import { Switch } from '@/components/ui/switch' // or create if not exists

<div className="mb-6 flex items-center justify-between rounded-lg border p-4">
  <div>
    <p className="font-medium">다른 유저에게 공개</p>
    <p className="text-sm text-muted-foreground">커뮤니티에서 이 Clone을 볼 수 있습니다</p>
  </div>
  <Switch checked={isPublic} onCheckedChange={handlePublicToggle} />
</div>
```

- [ ] **Step 3: Add field-level lock icons**

In each PersonaFieldRow (or wherever individual fields are rendered), add a small lock icon button next to the label:

```tsx
// Lock icon component
function FieldLockToggle({ field, isPublic, publicFields, onToggle, disabled }: {
  field: string
  isPublic: boolean
  publicFields: string[]
  onToggle: (field: string) => void
  disabled: boolean
}) {
  const isFieldPublic = publicFields.includes(field)
  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      disabled={disabled || !isPublic}
      className="ml-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
      title={isFieldPublic ? '공개 (클릭하여 비공개로)' : '비공개 (클릭하여 공개로)'}
    >
      {isFieldPublic ? '🔓' : '🔒'}
    </button>
  )
}
```

- [ ] **Step 4: Wire up state + PATCH call**

Manage `isPublic` and `publicFields` in component state. On toggle change, PATCH to `/api/clones/[id]` with updated values.

```ts
async function handlePublicToggle(checked: boolean) {
  setIsPublic(checked)
  await fetch(`/api/clones/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_public: checked }),
  })
}

async function handleFieldToggle(field: string) {
  const updated = publicFields.includes(field)
    ? publicFields.filter((f) => f !== field)
    : [...publicFields, field]
  setPublicFields(updated)
  await fetch(`/api/clones/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_fields: updated }),
  })
}
```

- [ ] **Step 5: Typecheck + manual test**

Run: `cd frontend && npx tsc --noEmit`
Test: toggle is_public on/off, toggle individual field locks, verify changes persist.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/clones/[id]/edit/page.tsx
git commit -m "feat(ui): is_public toggle + field-level lock icons on clone edit page"
```

---

## Group D: Interaction Pair Picker

### Task 11: Pair Picker + /interactions/new

**Files:**
- Modify: `frontend/src/components/interaction/InteractionPairPicker.tsx`
- Modify: `frontend/src/app/interactions/new/page.tsx`

- [ ] **Step 1: Read current components**

Read InteractionPairPicker.tsx and the new interaction page.

- [ ] **Step 2: Update InteractionPairPicker props**

Add `community` to props:

```tsx
interface InteractionPairPickerProps {
  mine: Clone[]
  community: Clone[]
  npcs: Clone[]
  selected: [string | null, string | null]
  onChange: (pair: [string | null, string | null]) => void
}
```

Update the partner column (second picker) to include community clones in order: mine (excluding selected[0]) → community → NPCs. Add badge indicators to distinguish each type.

- [ ] **Step 3: Update /interactions/new to pass community**

The page's useEffect already fetches `/api/clones`. Update to destructure `community` from the response and pass it to the picker.

- [ ] **Step 4: Typecheck + manual test**

Run: `cd frontend && npx tsc --noEmit`
Test: open /interactions/new, verify community clones appear in partner picker with badge.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/interaction/InteractionPairPicker.tsx frontend/src/app/interactions/new/page.tsx
git commit -m "feat(ui): pair picker includes community clones with badge"
```

---

## Group E: Admin Interactions

### Task 12: Admin Interactions API

**Files:**
- Create: `frontend/src/app/api/admin/interactions/route.ts`
- Create: `frontend/src/app/api/admin/interactions/[id]/route.ts`

- [ ] **Step 1: Create GET /api/admin/interactions**

```ts
// frontend/src/app/api/admin/interactions/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin/guard'
import { AppError } from '@/lib/errors'

function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status })
  }
  console.error('Unhandled:', err)
  return NextResponse.json({ error: { code: 'INTERNAL', message: '서버 오류' } }, { status: 500 })
}

export async function GET() {
  try {
    await requireAdmin()
    const service = createServiceClient()

    const { data, error } = await service
      .from('interactions')
      .select(`
        *,
        interaction_participants (
          clone_id,
          role,
          clones ( id, name, is_npc, user_id )
        )
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw new AppError('INTERNAL', error.message, 500)
    return NextResponse.json({ data })
  } catch (err) {
    return toErrorResponse(err)
  }
}
```

- [ ] **Step 2: Create DELETE /api/admin/interactions/[id]**

```ts
// frontend/src/app/api/admin/interactions/[id]/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin/guard'
import { AppError } from '@/lib/errors'

function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status })
  }
  console.error('Unhandled:', err)
  return NextResponse.json({ error: { code: 'INTERNAL', message: '서버 오류' } }, { status: 500 })
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
    const { id } = await ctx.params
    const service = createServiceClient()

    // Soft delete
    const { error } = await service
      .from('interactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw new AppError('INTERNAL', error.message, 500)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/api/admin/interactions/
git commit -m "feat(api): admin interactions list + delete endpoints"
```

---

### Task 13: Admin Interactions Page

**Files:**
- Create: `frontend/src/app/admin/interactions/page.tsx`

- [ ] **Step 1: Create admin interactions page**

```tsx
// frontend/src/app/admin/interactions/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface ParticipantClone {
  id: string
  name: string
  is_npc: boolean
  user_id: string | null
}

interface InteractionRow {
  id: string
  status: string
  max_turns: number
  created_at: string
  ended_at: string | null
  metadata: Record<string, unknown>
  interaction_participants: Array<{
    clone_id: string
    role: string
    clones: ParticipantClone
  }>
}

export default function AdminInteractionsPage() {
  const [interactions, setInteractions] = useState<InteractionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInteractions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/interactions')
      if (!res.ok) throw new Error('로드 실패')
      const body = await res.json()
      setInteractions(body.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchInteractions() }, [fetchInteractions])

  async function handleDelete(id: string) {
    if (!confirm('이 interaction을 삭제하시겠습니까?')) return
    try {
      await fetch(`/api/admin/interactions/${id}`, { method: 'DELETE' })
      fetchInteractions()
    } catch {
      setError('삭제 실패')
    }
  }

  function getCloneNames(row: InteractionRow): string {
    const names = row.interaction_participants
      .map((p) => p.clones?.name ?? '?')
    return names.join(' × ')
  }

  function getTurnCount(row: InteractionRow): number {
    return (row.metadata as { turnsCompleted?: number })?.turnsCompleted ?? 0
  }

  const statusColors: Record<string, string> = {
    completed: 'text-green-600',
    running: 'text-blue-600',
    pending: 'text-yellow-600',
    failed: 'text-red-600',
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Interactions 관리</h1>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {loading && <p className="text-sm text-muted-foreground">로딩...</p>}

      {!loading && interactions.length === 0 && (
        <p className="text-sm text-muted-foreground">interaction이 없습니다</p>
      )}

      <div className="space-y-2">
        {interactions.map((row) => (
          <div key={row.id} className="flex items-center gap-4 rounded-lg border p-4">
            <div className="min-w-0 flex-1">
              <Link href={`/interactions/${row.id}`} className="font-medium hover:underline">
                {getCloneNames(row)}
              </Link>
              <div className="mt-1 flex gap-3 text-sm text-muted-foreground">
                <span className={statusColors[row.status] ?? ''}>{row.status}</span>
                <span>{getTurnCount(row)}턴</span>
                <span>{new Date(row.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)}>
              삭제
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + manual test**

Run: `cd frontend && npx tsc --noEmit`
Test: navigate to `/admin/interactions`, verify list loads, delete works.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/interactions/
git commit -m "feat(admin): /admin/interactions page for viewing and deleting all interactions"
```

---

## Group F: Smoke Test

### Task 14: Verification + Deploy

- [ ] **Step 1: Run full test suite**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Manual smoke test**

1. Create a second test user (or use incognito)
2. Verify `/clones` shows 3 sections
3. Create clone with user A → verify it appears in user B's community section
4. Toggle is_public off on user A's clone → verify it disappears from user B's view
5. Toggle field locks → verify filtered fields on user B's view
6. Create interaction with community clone as partner
7. Admin: verify `/admin/interactions` lists all interactions, delete works

- [ ] **Step 4: Deploy**

```bash
git push origin main
```

---

## File Summary

### New Files (6)
| File | Purpose |
|---|---|
| `supabase/migrations/20260412000003_clone_visibility.sql` | is_public + public_fields + RLS |
| `src/lib/clone/publicFields.ts` | Constants + filter function |
| `src/lib/clone/publicFields.test.ts` | Filter function tests |
| `src/app/api/admin/interactions/route.ts` | Admin interactions list |
| `src/app/api/admin/interactions/[id]/route.ts` | Admin interaction delete |
| `src/app/admin/interactions/page.tsx` | Admin interactions page |

### Modified Files (8)
| File | Change |
|---|---|
| `src/lib/validation/persona.ts` | Add is_public + public_fields to updateCloneSchema |
| `src/app/api/clones/route.ts` | 3-group response with persona filtering |
| `src/app/api/clones/[id]/route.ts` | Persona filtering for non-owner + PATCH support |
| `src/app/clones/page.tsx` | 3-section layout |
| `src/components/clone/CloneList.tsx` | Accept community prop |
| `src/components/clone/CloneCard.tsx` | Badge prop (mine/community/npc) |
| `src/app/clones/[id]/page.tsx` | Community clone detail view |
| `src/app/clones/[id]/edit/page.tsx` | is_public toggle + field lock icons |
| `src/components/interaction/InteractionPairPicker.tsx` | Community clones in partner picker |
| `src/app/interactions/new/page.tsx` | Pass community to picker |
