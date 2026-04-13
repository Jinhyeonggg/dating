'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { INTERACTION_PRESETS, type InteractionMode } from '@/lib/config/runtime'

interface ConfigState {
  interactionMode: InteractionMode
  relationshipMemoryEnabled: boolean
  pairMemoryInjection: boolean
  otherMemoryInjection: boolean
  pairMemoryInjectionLimit: number
  otherMemoryInjectionLimit: number
}

const MODE_LABELS: Record<InteractionMode, string> = {
  economy: '절약',
  normal: '정상',
}

export default function AdminConfigPage() {
  const [config, setConfig] = useState<ConfigState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config')
      if (!res.ok) throw new Error('설정을 불러올 수 없습니다')
      const data = await res.json()
      setConfig(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  async function updateConfig(patch: Partial<ConfigState>) {
    setSaving(true)
    setToast(null)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('설정 변경에 실패했습니다')
      const data = await res.json()
      setConfig(data)
      setToast('설정이 변경되었습니다')
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">플랫폼 설정</h1>
        <p className="text-muted-foreground">불러오는 중...</p>
      </div>
    )
  }

  if (error && !config) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">플랫폼 설정</h1>
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  const mode = config!.interactionMode
  const preset = INTERACTION_PRESETS[mode]

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">플랫폼 설정</h1>
        <div className="flex gap-2 text-sm text-muted-foreground">
          <Link href="/admin/interactions" className="hover:underline">Interactions</Link>
          <span>·</span>
          <Link href="/admin/clones" className="hover:underline">Clones</Link>
          <span>·</span>
          <Link href="/admin/world" className="hover:underline">World</Link>
        </div>
      </div>

      {toast && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {toast}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Interaction 모드 */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">Interaction 모드</CardTitle>
          <CardDescription>모델, 턴 수, 출력 토큰을 프리셋으로 전환</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button
              variant={mode === 'economy' ? 'default' : 'outline'}
              size="sm"
              disabled={saving || mode === 'economy'}
              onClick={() => updateConfig({ interactionMode: 'economy' })}
            >
              절약
            </Button>
            <Button
              variant={mode === 'normal' ? 'default' : 'outline'}
              size="sm"
              disabled={saving || mode === 'normal'}
              onClick={() => updateConfig({ interactionMode: 'normal' })}
            >
              정상
            </Button>
          </div>
          <div className="mt-3 rounded-md bg-muted px-3 py-2 text-sm">
            <p>현재: <strong>{MODE_LABELS[mode]}</strong></p>
            <p className="text-muted-foreground">
              모델: {preset.model} · 턴: {preset.maxTurns} · 토큰: {preset.maxOutputTokens}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 관계 기억 추출 */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">관계 기억 추출</CardTitle>
          <CardDescription>Interaction 종료 후 양방향 관계 기억 자동 추출</CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleButtons
            value={config!.relationshipMemoryEnabled}
            disabled={saving}
            onToggle={(v) => updateConfig({ relationshipMemoryEnabled: v })}
          />
        </CardContent>
      </Card>

      {/* 대상 클론 기억 주입 */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">대상 클론 기억 주입</CardTitle>
          <CardDescription>대화 상대(A↔B)의 과거 대화 기억을 주입</CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleButtons
            value={config!.pairMemoryInjection}
            disabled={saving}
            onToggle={(v) => updateConfig({ pairMemoryInjection: v })}
          />
          <LimitInput
            label="최대 개수"
            value={config!.pairMemoryInjectionLimit}
            disabled={saving}
            onSave={(v) => updateConfig({ pairMemoryInjectionLimit: v })}
          />
        </CardContent>
      </Card>

      {/* 다른 클론 기억 주입 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">다른 클론 기억 주입</CardTitle>
          <CardDescription>대화 상대 외 다른 클론들(A↔C, A↔D...)과의 기억도 주입</CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleButtons
            value={config!.otherMemoryInjection}
            disabled={saving}
            onToggle={(v) => updateConfig({ otherMemoryInjection: v })}
          />
          <LimitInput
            label="최대 개수"
            value={config!.otherMemoryInjectionLimit}
            disabled={saving}
            onSave={(v) => updateConfig({ otherMemoryInjectionLimit: v })}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function ToggleButtons({
  value,
  disabled,
  onToggle,
}: {
  value: boolean
  disabled: boolean
  onToggle: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant={value ? 'default' : 'outline'}
        size="sm"
        disabled={disabled || value}
        onClick={() => onToggle(true)}
      >
        ON
      </Button>
      <Button
        variant={!value ? 'default' : 'outline'}
        size="sm"
        disabled={disabled || !value}
        onClick={() => onToggle(false)}
      >
        OFF
      </Button>
    </div>
  )
}

function LimitInput({
  label,
  value,
  disabled,
  onSave,
}: {
  label: string
  value: number
  disabled: boolean
  onSave: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  function handleSave() {
    const num = parseInt(draft, 10)
    if (!isNaN(num) && num >= 0 && num !== value) {
      onSave(num)
    }
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}:</span>
      <Input
        type="number"
        min={0}
        className="w-20"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={disabled}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
      />
    </div>
  )
}
