'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Interaction, InteractionStatus } from '@/types/interaction'

interface CloneInfo {
  id: string
  name: string
  is_npc: boolean
  user_id: string | null
}

interface Participant {
  clone_id: string
  role: string | null
  clones: CloneInfo | null
}

interface AdminInteraction extends Interaction {
  interaction_participants: Participant[]
}

const STATUS_COLORS: Record<InteractionStatus, string> = {
  completed: 'text-green-600',
  running: 'text-blue-600',
  pending: 'text-yellow-600',
  failed: 'text-red-600',
  cancelled: 'text-gray-500',
}

function getCloneNames(participants: Participant[]): string {
  const names = participants
    .map((p) => p.clones?.name ?? '알 수 없음')
    .filter(Boolean)
  if (names.length === 0) return '—'
  return names.join(' × ')
}

function getTurnsCompleted(metadata: Record<string, unknown>): number | null {
  const v = metadata?.turnsCompleted
  return typeof v === 'number' ? v : null
}

export default function AdminInteractionsPage() {
  const [interactions, setInteractions] = useState<AdminInteraction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchInteractions() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/interactions')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error?.message ?? '불러오기 실패')
        setInteractions(json.data ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : '오류')
      } finally {
        setLoading(false)
      }
    }
    fetchInteractions()
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('이 Interaction을 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/admin/interactions/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '삭제 실패')
      setInteractions((prev) => prev.filter((i) => i.id !== id))
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 오류')
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Admin — Interactions</h1>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-red-600 bg-red-50 p-4 rounded-lg">{error}</p>
      )}

      {!loading && !error && interactions.length === 0 && (
        <p className="text-gray-500 py-12 text-center">Interaction이 없습니다.</p>
      )}

      {!loading && !error && interactions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">참여 클론</th>
                <th className="py-2 pr-4 font-medium">상태</th>
                <th className="py-2 pr-4 font-medium">턴</th>
                <th className="py-2 pr-4 font-medium">생성일</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {interactions.map((interaction) => {
                const turns = getTurnsCompleted(interaction.metadata)
                const statusColor =
                  STATUS_COLORS[interaction.status] ?? 'text-gray-500'
                const createdAt = new Date(interaction.created_at).toLocaleDateString(
                  'ko-KR',
                  { year: 'numeric', month: '2-digit', day: '2-digit' }
                )

                return (
                  <tr key={interaction.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/interactions/${interaction.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {getCloneNames(interaction.interaction_participants)}
                      </Link>
                    </td>
                    <td className={`py-3 pr-4 font-medium ${statusColor}`}>
                      {interaction.status}
                    </td>
                    <td className="py-3 pr-4 text-gray-700">
                      {turns !== null ? turns : '—'}
                    </td>
                    <td className="py-3 pr-4 text-gray-500">{createdAt}</td>
                    <td className="py-3">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(interaction.id)}
                      >
                        삭제
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
