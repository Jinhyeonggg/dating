'use client'

import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { PersonaSection } from './PersonaSection'
import { PERSONA_SECTIONS } from '@/lib/constants/personaFields'
import { personaSchema, type PersonaInput } from '@/lib/validation/persona'
import type { Persona } from '@/types/persona'

interface PersonaFullEditorProps {
  initialPersona: Persona
  onSubmit: (persona: PersonaInput) => Promise<void>
  submitting?: boolean
}

export function PersonaFullEditor({
  initialPersona,
  onSubmit,
  submitting,
}: PersonaFullEditorProps) {
  const methods = useForm<PersonaInput>({
    resolver: zodResolver(personaSchema),
    defaultValues: initialPersona as unknown as PersonaInput,
  })

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs
          defaultValue={PERSONA_SECTIONS[0].category}
          orientation="vertical"
          className="gap-6"
        >
          <TabsList className="min-w-40 shrink-0">
            {PERSONA_SECTIONS.map((s) => (
              <TabsTrigger key={s.category} value={s.category}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex-1 min-w-0 min-h-[32rem]">
            {PERSONA_SECTIONS.map((s) => (
              <TabsContent key={s.category} value={s.category}>
                <PersonaSection control={methods.control} category={s.category} />
              </TabsContent>
            ))}
          </div>
        </Tabs>

        <div className="flex gap-2 border-t pt-4">
          <Button type="submit" disabled={submitting}>
            {submitting ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
