import Link from 'next/link'
import { Plus, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface Props {
  partnerId?: string
}

export function NewInteractionHero({ partnerId }: Props) {
  const href = partnerId
    ? `/interactions/new?partnerId=${partnerId}`
    : '/interactions/new'

  return (
    <Link href={href} className="block">
      <Card className="group relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background p-6 transition-all hover:border-primary/40 hover:shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-110">
            <Plus className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">새로운 대화 시작하기</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              내 Clone과 다른 Clone의 대화를 시뮬레이션하고 호환성을 탐색해보세요.
            </p>
          </div>
          <ArrowRight className="hidden h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 sm:block" />
        </div>
      </Card>
    </Link>
  )
}
