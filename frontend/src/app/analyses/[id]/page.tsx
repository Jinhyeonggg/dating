import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AnalysisReport } from '@/components/analysis/AnalysisReport'
import type { Analysis } from '@/types/analysis'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AnalysisPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: analysis } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', id)
    .maybeSingle<Analysis>()

  if (!analysis) notFound()

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4">
        <Link
          href={`/interactions/${analysis.interaction_id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Interaction으로 돌아가기
        </Link>
      </div>
      <AnalysisReport analysis={analysis} />
    </main>
  )
}
