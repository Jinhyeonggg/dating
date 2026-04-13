'use client'

import { useEffect } from 'react'

interface Props {
  interactionId: string
  status: string
}

/**
 * completed interaction 페이지 방문 시 관계 기억 추출이 안 되어 있으면 트리거.
 * after() 실패 시 fallback 역할.
 */
export function RelationshipExtractTrigger({ interactionId, status }: Props) {
  useEffect(() => {
    if (status !== 'completed') return

    // 약간의 딜레이 후 실행 (after()가 먼저 완료될 시간 확보)
    const timer = setTimeout(() => {
      fetch(`/api/interactions/${interactionId}/extract-memories`, {
        method: 'POST',
      }).catch(() => {
        // silent — best effort
      })
    }, 3000)

    return () => clearTimeout(timer)
  }, [interactionId, status])

  return null
}
