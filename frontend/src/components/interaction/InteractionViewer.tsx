'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { subscribeInteractionEvents, type ConnectionStatus } from '@/lib/supabase/realtime'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { InteractionStatusBadge } from './InteractionStatusBadge'
import { InteractionProgressBar } from './InteractionProgressBar'
import { Card } from '@/components/ui/card'
import { INTERACTION_DEFAULTS } from '@/lib/config/interaction'
import type { Interaction, InteractionEvent, InteractionStatus } from '@/types/interaction'
import type { Clone } from '@/types/persona'

interface Props {
  interaction: Interaction
  initialEvents: InteractionEvent[]
  participants: Clone[] // length 2, order = side [left, right]
}

export function InteractionViewer({ interaction, initialEvents, participants }: Props) {
  const [events, setEvents] = useState<InteractionEvent[]>(initialEvents)
  const [status, setStatus] = useState<InteractionStatus>(interaction.status)
  const [connection, setConnection] = useState<ConnectionStatus>('connecting')
  const [lastEventAt, setLastEventAt] = useState<number>(() => Date.now())
  const [heartbeatStale, setHeartbeatStale] = useState(false)
  const runTriggeredRef = useRef(false)

  const [leftClone, rightClone] = participants

  // Realtime 구독
  useEffect(() => {
    const sub = subscribeInteractionEvents({
      interactionId: interaction.id,
      onEvent: (e) => {
        setEvents((prev) => {
          if (prev.some((x) => x.id === e.id)) return prev
          return [...prev, e].sort((a, b) => a.turn_number - b.turn_number)
        })
        setLastEventAt(Date.now())
        setHeartbeatStale(false)
      },
      onStatusChange: setConnection,
    })
    return () => sub.unsubscribe()
  }, [interaction.id])

  // run 트리거 (pending 상태에서만 1회)
  useEffect(() => {
    if (runTriggeredRef.current) return
    if (interaction.status !== 'pending') return
    runTriggeredRef.current = true
    fetch(`/api/interactions/${interaction.id}/run`, { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        if (data?.status) setStatus(data.status)
      })
      .catch(() => {
        // 네트워크 실패해도 서버가 실행 중일 수 있음 — Realtime이 상태 복구
      })
  }, [interaction.id, interaction.status])

  // heartbeat 모니터링
  useEffect(() => {
    if (status !== 'running') return
    const interval = setInterval(() => {
      if (Date.now() - lastEventAt > INTERACTION_DEFAULTS.HEARTBEAT_WARNING_MS) {
        setHeartbeatStale(true)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [lastEventAt, status])

  // status polling (run 끝나면 Realtime으로 오는 게 아니라 server update → poll로 보완)
  useEffect(() => {
    if (status === 'completed' || status === 'failed') return
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/interactions/${interaction.id}`)
        const data = await r.json()
        if (data?.interaction?.status) {
          setStatus(data.interaction.status)
        }
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [interaction.id, status])

  const sideOf = (cloneId: string): 'left' | 'right' =>
    cloneId === leftClone.id ? 'left' : 'right'

  const maxTurns = interaction.max_turns
  const nextSpeaker = useMemo(() => {
    if (status !== 'running') return null
    const nextTurn = events.length
    if (nextTurn >= maxTurns) return null
    return participants[nextTurn % participants.length]
  }, [events.length, maxTurns, participants, status])

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {leftClone.name} × {rightClone.name}
          </h2>
          <InteractionStatusBadge status={status} />
        </div>
        <p className="mb-3 text-sm text-muted-foreground">{interaction.scenario}</p>
        <InteractionProgressBar current={events.length} total={maxTurns} />
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Realtime: {connection}</span>
          {heartbeatStale && status === 'running' && (
            <span className="text-amber-600">응답 기다리는 중...</span>
          )}
        </div>
      </Card>

      <div className="min-h-[360px] space-y-3">
        {events.length === 0 && status === 'pending' && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            대화를 시작하는 중...
          </Card>
        )}
        {events.map((e) => {
          const speaker = participants.find((p) => p.id === e.speaker_clone_id)
          return (
            <MessageBubble
              key={e.id}
              turnNumber={e.turn_number}
              speakerName={speaker?.name ?? '?'}
              content={e.content}
              side={sideOf(e.speaker_clone_id)}
            />
          )
        })}
        {nextSpeaker && (
          <TypingIndicator
            speakerName={nextSpeaker.name}
            side={sideOf(nextSpeaker.id)}
          />
        )}
      </div>

      {status === 'completed' && (
        <Card className="p-4 text-center">
          <p className="mb-2 text-sm">대화가 완료되었습니다.</p>
          <p className="text-xs text-muted-foreground">
            호환성 분석은 Plan 5에서 활성화됩니다.
          </p>
        </Card>
      )}
      {status === 'failed' && (
        <Card className="p-4 text-center text-destructive">
          <p className="text-sm">대화 실행에 실패했습니다. 새 Interaction을 시작해보세요.</p>
        </Card>
      )}
    </div>
  )
}
