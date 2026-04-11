import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { END_PROMISE_MARKER } from '@/lib/config/interaction'

export interface MessageBubbleProps {
  speakerName: string
  content: string
  side: 'left' | 'right'
  turnNumber: number
}

export function MessageBubble({
  speakerName,
  content,
  side,
  turnNumber,
}: MessageBubbleProps) {
  const cleanContent = content.replaceAll(END_PROMISE_MARKER, '').trim()
  return (
    <div
      className={cn(
        'flex w-full gap-2',
        side === 'right' ? 'justify-end' : 'justify-start'
      )}
    >
      <div className={cn('max-w-[75%]', side === 'right' ? 'order-2' : '')}>
        <p className="mb-1 text-xs text-muted-foreground">{speakerName}</p>
        <Card
          className={cn(
            'px-4 py-2 text-sm leading-relaxed',
            side === 'right'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          )}
        >
          {cleanContent}
        </Card>
        <p className="mt-1 text-[10px] text-muted-foreground">#{turnNumber + 1}</p>
      </div>
    </div>
  )
}
