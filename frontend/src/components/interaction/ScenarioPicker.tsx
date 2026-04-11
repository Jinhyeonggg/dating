'use client'

import { DEFAULT_SCENARIOS } from '@/lib/config/interaction'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (id: string) => void
}

export function ScenarioPicker({ value, onChange }: Props) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {DEFAULT_SCENARIOS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={cn('text-left', value === s.id ? 'ring-2 ring-primary' : '')}
        >
          <Card className="flex h-full min-h-[6rem] flex-col p-3 transition hover:bg-muted/50">
            <p className="font-medium">{s.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
          </Card>
        </button>
      ))}
    </div>
  )
}
