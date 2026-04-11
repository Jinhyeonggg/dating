import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PersonaSummaryCard } from '@/components/persona/PersonaSummaryCard'
import { PersonaDetailView } from '@/components/persona/PersonaDetailView'
import { CloneNpcBadge } from '@/components/clone/CloneNpcBadge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Clone } from '@/types/persona'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CloneDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: clone } = await supabase
    .from('clones')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single<Clone>()

  if (!clone) notFound()

  const isOwner = !clone.is_npc && clone.user_id === user?.id

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/clones" className="text-sm text-muted-foreground hover:underline">
          ← 목록으로
        </Link>
        {isOwner && (
          <Link
            href={`/clones/${clone.id}/edit`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            상세 편집
          </Link>
        )}
      </div>

      <Card className="mb-6 p-6">
        {clone.is_npc && (
          <div className="mb-4">
            <CloneNpcBadge />
          </div>
        )}
        <PersonaSummaryCard persona={clone.persona_json} />
      </Card>

      <PersonaDetailView persona={clone.persona_json} />
    </main>
  )
}
