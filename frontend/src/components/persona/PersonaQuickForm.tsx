'use client'

import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { PersonaSection } from './PersonaSection'
import { QUICK_FORM_FIELDS } from '@/lib/constants/personaFields'
import { personaSchema, type PersonaInput } from '@/lib/validation/persona'

interface PersonaQuickFormProps {
  onSubmit: (persona: PersonaInput) => Promise<void>
  submitting?: boolean
}

const DEFAULT_VALUES: PersonaInput = {
  name: '',
  age: null,
  gender: null,
  location: null,
  occupation: null,
  education: null,
  languages: null,
  mbti: null,
  personality_traits: null,
  strengths: null,
  weaknesses: null,
  humor_style: null,
  emotional_expression: null,
  core_values: null,
  beliefs: null,
  life_philosophy: null,
  dealbreakers: null,
  hobbies: null,
  favorite_media: null,
  food_preferences: null,
  travel_style: null,
  background_story: null,
  key_life_events: null,
  career_history: null,
  past_relationships_summary: null,
  family_description: null,
  close_friends_count: null,
  social_style: null,
  relationship_with_family: null,
  daily_routine: null,
  sleep_schedule: null,
  exercise_habits: null,
  diet: null,
  pets: null,
  living_situation: null,
  communication_style: null,
  conversation_preferences: null,
  texting_style: null,
  response_speed: null,
  short_term_goals: null,
  long_term_goals: null,
  what_seeking_in_others: null,
  relationship_goal: null,
  self_description: null,
  tags: null,
}

export function PersonaQuickForm({ onSubmit, submitting }: PersonaQuickFormProps) {
  const methods = useForm<PersonaInput>({
    resolver: zodResolver(personaSchema),
    defaultValues: DEFAULT_VALUES,
  })

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        <PersonaSection
          control={methods.control}
          fields={QUICK_FORM_FIELDS}
          showHeader={false}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? '생성 중...' : 'Clone 생성'}
        </Button>
      </form>
    </FormProvider>
  )
}
