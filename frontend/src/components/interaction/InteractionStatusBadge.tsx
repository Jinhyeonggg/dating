import { Badge } from '@/components/ui/badge'
import type { InteractionStatus } from '@/types/interaction'

const LABELS: Record<InteractionStatus, string> = {
  pending: '대기',
  running: '진행 중',
  completed: '완료',
  failed: '실패',
  cancelled: '취소',
}

const VARIANTS: Record<
  InteractionStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'outline',
  running: 'default',
  completed: 'secondary',
  failed: 'destructive',
  cancelled: 'outline',
}

export function InteractionStatusBadge({ status }: { status: InteractionStatus }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>
}
