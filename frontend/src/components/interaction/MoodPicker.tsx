'use client'

import { CONVERSATION_MOODS } from '@/lib/config/interaction'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (id: string) => void
}

export function MoodPicker({ value, onChange }: Props) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {CONVERSATION_MOODS.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={cn('text-left', value === m.id ? 'ring-2 ring-primary' : '')}
        >
          <Card className="flex h-full min-h-[6rem] flex-col p-3 transition hover:bg-muted/50">
            <p className="font-medium">{m.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
          </Card>
        </button>
      ))}
    </div>
  )
}
