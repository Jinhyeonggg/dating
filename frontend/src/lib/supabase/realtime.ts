import { createClient } from './client'
import type { RealtimeChannel, RealtimePostgresInsertPayload } from '@supabase/supabase-js'
import type { InteractionEvent } from '@/types/interaction'

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline'

export interface InteractionEventsSubscription {
  unsubscribe: () => void
}

export interface SubscribeOptions {
  interactionId: string
  onEvent: (event: InteractionEvent) => void
  onStatusChange?: (status: ConnectionStatus) => void
}

export function subscribeInteractionEvents(
  opts: SubscribeOptions
): InteractionEventsSubscription {
  const supabase = createClient()
  let channel: RealtimeChannel | null = null
  let cancelled = false

  function connect(retryCount: number) {
    if (cancelled) return
    opts.onStatusChange?.(retryCount === 0 ? 'connecting' : 'reconnecting')

    channel = supabase
      .channel(`interaction:${opts.interactionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'interaction_events',
          filter: `interaction_id=eq.${opts.interactionId}`,
        },
        (payload: RealtimePostgresInsertPayload<InteractionEvent>) => {
          if (payload.new) opts.onEvent(payload.new)
        }
      )
      .subscribe((status) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          opts.onStatusChange?.('connected')
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          opts.onStatusChange?.('offline')
          const delay = Math.min(30000, 1000 * Math.pow(2, retryCount))
          setTimeout(() => {
            if (cancelled) return
            if (channel) supabase.removeChannel(channel)
            connect(retryCount + 1)
          }, delay)
        }
      })
  }

  connect(0)

  return {
    unsubscribe: () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    },
  }
}
