'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { INTERACTION_PRESETS, type InteractionMode } from '@/lib/config/runtime'

interface ConfigState {
  interactionMode: InteractionMode
  relationshipMemoryEnabled: boolean
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
  const otherMode: InteractionMode = mode === 'economy' ? 'normal' : 'economy'

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

      {/* 관계 기억 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">관계 기억</CardTitle>
          <CardDescription>Interaction 종료 후 양방향 관계 기억 자동 추출</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button
              variant={config!.relationshipMemoryEnabled ? 'default' : 'outline'}
              size="sm"
              disabled={saving || config!.relationshipMemoryEnabled}
              onClick={() => updateConfig({ relationshipMemoryEnabled: true })}
            >
              ON
            </Button>
            <Button
              variant={!config!.relationshipMemoryEnabled ? 'default' : 'outline'}
              size="sm"
              disabled={saving || !config!.relationshipMemoryEnabled}
              onClick={() => updateConfig({ relationshipMemoryEnabled: false })}
            >
              OFF
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {config!.relationshipMemoryEnabled
              ? 'Interaction 완료 시 관계 기억이 자동 추출됩니다.'
              : '관계 기억 추출이 비활성화되어 있습니다. 토큰을 절약합니다.'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
