'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface ArrayInputProps {
  value: string[] | null
  onChange: (value: string[] | null) => void
  placeholder?: string
}

export function ArrayInput({ value, onChange, placeholder }: ArrayInputProps) {
  const [draft, setDraft] = useState('')
  const items = value ?? []

  function addItem() {
    const trimmed = draft.trim()
    if (trimmed.length === 0) return
    onChange([...items, trimmed])
    setDraft('')
  }

  function removeAt(index: number) {
    const next = items.filter((_, i) => i !== index)
    onChange(next.length === 0 ? null : next)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // 한글 IME 조합 중인 Enter는 글자 확정용이므로 무시
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              addItem()
            }
          }}
          placeholder={placeholder ?? '항목 입력 후 Enter'}
        />
        <Button type="button" variant="outline" onClick={addItem}>
          추가
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <Badge key={`${item}-${i}`} variant="secondary" className="gap-1">
              {item}
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="ml-1 rounded hover:bg-muted"
                aria-label={`${item} 삭제`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
