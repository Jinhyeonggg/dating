import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Clone } from '@/types/persona'

interface Props {
  clones: Clone[]
  selectedId: string
}

export function MyCloneSelector({ clones, selectedId }: Props) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {clones.map((c) => {
        const active = c.id === selectedId
        const chips: string[] = []
        if (c.persona_json.age !== null) chips.push(`${c.persona_json.age}`)
        if (c.persona_json.occupation) chips.push(c.persona_json.occupation)
        if (c.persona_json.mbti) chips.push(c.persona_json.mbti)

        return (
          <Link
            key={c.id}
            href={`/clones/mine?selected=${c.id}`}
            scroll={false}
            className="shrink-0"
          >
            <Card
              className={cn(
                'flex h-full min-h-[5.5rem] w-56 flex-col p-3 transition hover:bg-muted/50',
                active && 'ring-2 ring-primary bg-muted/30'
              )}
            >
              <p className="truncate text-sm font-semibold">{c.name}</p>
              <p className="mt-1 line-clamp-1 min-h-[1rem] text-xs text-muted-foreground">
                {chips.length > 0 ? chips.join(' · ') : '\u00A0'}
              </p>
              <p className="mt-1 line-clamp-2 min-h-[2rem] text-xs text-muted-foreground">
                {c.persona_json.self_description ?? '\u00A0'}
              </p>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
