'use client'

import { useState } from 'react'
import type { Persona } from '@/types/persona'
import { PersonaDetailView } from './PersonaDetailView'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface ExpandablePersonaDetailProps {
  persona: Persona
}

export function ExpandablePersonaDetail({
  persona,
}: ExpandablePersonaDetailProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              <ChevronUp className="mr-1 h-4 w-4" />
              접기
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-4 w-4" />
              모든 정보 펼쳐보기
            </>
          )}
        </Button>
      </div>
      {expanded && <PersonaDetailView persona={persona} />}
    </div>
  )
}
