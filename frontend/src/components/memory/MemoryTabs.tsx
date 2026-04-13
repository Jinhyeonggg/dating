'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MemoryInputBox } from './MemoryInputBox'
import { MemoryItem } from './MemoryItem'
import type { CloneMemory } from '@/types/persona'
import type { CloneRelationship } from '@/types/relationship'

interface RelationshipWithName extends CloneRelationship {
  target_name: string
}

interface MemoryTabsProps {
  cloneId: string
  isOwner: boolean
  memories: CloneMemory[]
  relationships: RelationshipWithName[]
}

type Tab = 'memories' | 'relationships'

export function MemoryTabs({ cloneId, isOwner, memories, relationships }: MemoryTabsProps) {
  const [tab, setTab] = useState<Tab>('memories')

  return (
    <section className="mt-8">
      {/* 탭 헤더 */}
      <div className="mb-4 flex items-center gap-1 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => setTab('memories')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'memories'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="mr-1.5">📝</span>
          메모리
          <span className="ml-1.5 text-xs text-muted-foreground">
            ({memories.length})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('relationships')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'relationships'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="mr-1.5">💬</span>
          대화 기억
          <span className="ml-1.5 text-xs text-muted-foreground">
            ({relationships.length})
          </span>
        </button>
      </div>

      {/* 탭 설명 */}
      <p className="mb-3 text-xs text-muted-foreground">
        {tab === 'memories'
          ? '직접 입력한 근황이나 새로운 정보. 클론이 다음 대화에서 기억합니다.'
          : '다른 클론과의 대화에서 자동으로 형성된 인상과 기억입니다.'}
      </p>

      {/* 메모리 탭 */}
      {tab === 'memories' && (
        <>
          {isOwner && (
            <div className="mb-4">
              <MemoryInputBox cloneId={cloneId} />
            </div>
          )}
          {memories.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              아직 기록된 메모리가 없습니다. {isOwner ? '위에서 하나 추가해보세요.' : ''}
            </Card>
          ) : (
            <div className="space-y-2">
              {memories.map((m) => (
                <MemoryItem key={m.id} memory={m} />
              ))}
            </div>
          )}
        </>
      )}

      {/* 대화 기억 탭 */}
      {tab === 'relationships' && (
        <>
          {relationships.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              아직 대화 기억이 없습니다. 다른 클론과 대화하면 자동으로 기억이 형성됩니다.
            </Card>
          ) : (
            <div className="space-y-3">
              {relationships.map((rel) => {
                const isPending = rel.interaction_count === 0
                return (
                <Card key={rel.id} className={`p-4 ${isPending ? 'border-dashed opacity-70' : ''}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{rel.target_name}</span>
                    {isPending ? (
                      <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
                        대화 분석 중
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        대화 {rel.interaction_count}회
                      </Badge>
                    )}
                  </div>
                  <p className="mb-3 text-sm text-foreground/80">{rel.summary}</p>
                  {!isPending && rel.memories.length > 0 && (
                    <ul className="space-y-1.5">
                      {rel.memories.slice(-10).reverse().map((m, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs">
                          <Badge variant="secondary" className="mt-0.5 shrink-0 text-[9px]">
                            {m.topic}
                          </Badge>
                          <span className="flex-1 text-muted-foreground">
                            {m.detail}
                          </span>
                          {m.interaction_id ? (
                            <Link
                              href={`/interactions/${m.interaction_id}`}
                              className="shrink-0 text-[10px] text-blue-500 hover:underline"
                            >
                              대화 보기
                            </Link>
                          ) : (
                            <span className="shrink-0 text-[10px] text-muted-foreground/50">
                              {m.occurred_at}
                            </span>
                          )}
                        </li>
                      ))}
                      {rel.memories.length > 10 && (
                        <li className="text-[10px] text-muted-foreground">
                          +{rel.memories.length - 10}개 더...
                        </li>
                      )}
                    </ul>
                  )}
                </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}
