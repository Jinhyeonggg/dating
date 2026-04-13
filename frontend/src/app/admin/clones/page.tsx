'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface AdminClone {
  id: string
  name: string
  user_id: string | null
  is_npc: boolean
  is_public: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  owner_email: string | null
}

export default function AdminClonesPage() {
  const [clones, setClones] = useState<AdminClone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchClones() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/clones')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error?.message ?? '불러오기 실패')
        setClones(json.data ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : '오류')
      } finally {
        setLoading(false)
      }
    }
    fetchClones()
  }, [])

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 클론과 관련된 모든 interaction을 삭제합니다. 계속하시겠습니까?`)) return
    try {
      const res = await fetch(`/api/admin/clones/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '삭제 실패')
      alert(`삭제 완료 (관련 interaction ${json.deletedInteractions}개 삭제)`)
      setClones((prev) => prev.filter((c) => c.id !== id))
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 오류')
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Admin — Clones</h1>
        <Link href="/admin/interactions" className="text-sm text-muted-foreground hover:underline">
          Interactions 관리 →
        </Link>
        <Link href="/admin/config" className="text-sm text-muted-foreground hover:underline">
          설정 →
        </Link>
      </div>

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

      {!loading && !error && clones.length === 0 && (
        <p className="text-gray-500 py-12 text-center">Clone이 없습니다.</p>
      )}

      {!loading && !error && clones.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">이름</th>
                <th className="py-2 pr-4 font-medium">소유자</th>
                <th className="py-2 pr-4 font-medium">타입</th>
                <th className="py-2 pr-4 font-medium">공개</th>
                <th className="py-2 pr-4 font-medium">생성일</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {clones.map((clone) => (
                <tr key={clone.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/clones/${clone.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {clone.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-gray-500">
                    {clone.is_npc
                      ? '—'
                      : clone.owner_email ?? clone.user_id?.slice(0, 8) ?? '?'}
                  </td>
                  <td className="py-3 pr-4">
                    {clone.is_npc ? (
                      <Badge variant="secondary" className="text-xs">NPC</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">유저</Badge>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {clone.is_public ? (
                      <span className="text-green-600 text-xs">공개</span>
                    ) : (
                      <span className="text-gray-400 text-xs">비공개</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-gray-500">
                    {new Date(clone.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                  </td>
                  <td className="py-3">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(clone.id, clone.name)}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
