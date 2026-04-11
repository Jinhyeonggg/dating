import Link from 'next/link'
import type { Clone } from '@/types/persona'
import { Button } from '@/components/ui/button'
import { CloneCard } from './CloneCard'

interface CloneListProps {
  mine: Clone[]
  npcs: Clone[]
}

export function CloneList({ mine, npcs }: CloneListProps) {
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">내 Clone</h2>
          <Button asChild size="sm">
            <Link href="/clones/new">+ 새 Clone 만들기</Link>
          </Button>
        </div>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            아직 Clone이 없어요. 새로 만들어보세요.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((c) => (
              <CloneCard key={c.id} clone={c} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">NPC Clone</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {npcs.map((c) => (
            <CloneCard key={c.id} clone={c} />
          ))}
        </div>
      </section>
    </div>
  )
}
