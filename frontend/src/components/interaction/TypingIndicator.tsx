import { Card } from '@/components/ui/card'

interface TypingIndicatorProps {
  speakerName: string
  side: 'left' | 'right'
}

export function TypingIndicator({ speakerName, side }: TypingIndicatorProps) {
  const justify = side === 'right' ? 'justify-end' : 'justify-start'
  return (
    <div className={`flex w-full ${justify}`}>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">{speakerName}</p>
        <Card className="flex items-center gap-1 bg-muted px-4 py-3">
          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
        </Card>
      </div>
    </div>
  )
}
