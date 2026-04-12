'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WORLD_CATEGORIES } from '@/lib/world/types'
import type { WorldContextRow, WorldCategory } from '@/lib/world/types'

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayString(from: string): string {
  const d = new Date(from)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

const EMPTY_FORM = {
  category: '' as WorldCategory | '',
  headline: '',
  details: '',
  weight: 5,
}

export default function AdminWorldPage() {
  const [date, setDate] = useState(todayString)
  const [rows, setRows] = useState<WorldContextRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [copying, setCopying] = useState(false)

  const fetchRows = useCallback(async (d: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/world-context?date=${d}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '불러오기 실패')
      setRows(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRows(date)
  }, [date, fetchRows])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category || !form.headline.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/world-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          category: form.category,
          headline: form.headline.trim(),
          details: form.details.trim() || null,
          weight: form.weight,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '추가 실패')
      setRows((prev) => [...prev, json.data].sort((a, b) => b.weight - a.weight))
      setForm(EMPTY_FORM)
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      const res = await fetch(`/api/world-context/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '삭제 실패')
      setRows((prev) => prev.filter((r) => r.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류')
    }
  }

  async function handleCopyYesterday() {
    setCopying(true)
    setError(null)
    try {
      const from = yesterdayString(date)
      const res = await fetch('/api/world-context/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: date }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '복사 실패')
      await fetchRows(date)
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류')
    } finally {
      setCopying(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">World Context 관리</h1>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyYesterday}
            disabled={copying}
          >
            {copying ? '복사 중…' : '어제 복사'}
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Row table */}
      <div className="min-h-[200px] rounded-lg border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            불러오는 중…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            이 날짜에 데이터가 없습니다
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 w-24">카테고리</th>
                <th className="text-left px-3 py-2">헤드라인</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">상세</th>
                <th className="text-center px-3 py-2 w-16">가중치</th>
                <th className="w-12 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2 text-muted-foreground">{row.category}</td>
                  <td className="px-3 py-2 font-medium">{row.headline}</td>
                  <td className="px-3 py-2 text-muted-foreground hidden md:table-cell max-w-xs truncate">
                    {row.details ?? <span className="opacity-30">\u00A0</span>}
                  </td>
                  <td className="px-3 py-2 text-center">{row.weight}</td>
                  <td className="px-3 py-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(row.id)}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">새 항목 추가</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr_80px]">
          <Select
            value={form.category}
            onValueChange={(v) => setForm((f) => ({ ...f, category: v as WorldCategory }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="카테고리" />
            </SelectTrigger>
            <SelectContent>
              {WORLD_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="헤드라인"
            value={form.headline}
            onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
            maxLength={200}
            required
          />
          <Input
            type="number"
            placeholder="가중치"
            value={form.weight}
            min={1}
            max={10}
            onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))}
          />
        </div>
        <Textarea
          placeholder="상세 내용 (선택)"
          value={form.details}
          onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
          maxLength={1000}
          rows={2}
          className="resize-none min-h-[64px] field-sizing-[fixed]"
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={submitting || !form.category || !form.headline.trim()}>
            {submitting ? '추가 중…' : '추가'}
          </Button>
        </div>
      </form>
    </div>
  )
}
