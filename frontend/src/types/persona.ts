export interface Persona {
  // Identity
  name: string
  age: number | null
  gender: string | null
  location: string | null
  occupation: string | null
  education: string | null
  languages: string[] | null

  // Personality
  mbti: string | null
  personality_traits: string[] | null
  strengths: string[] | null
  weaknesses: string[] | null
  humor_style: string | null
  emotional_expression: string | null

  // Values
  core_values: string[] | null
  beliefs: string[] | null
  life_philosophy: string | null
  dealbreakers: string[] | null

  // Interests
  hobbies: string[] | null
  favorite_media: {
    movies: string[] | null
    books: string[] | null
    music: string[] | null
    games: string[] | null
  } | null
  food_preferences: string[] | null
  travel_style: string | null

  // History
  background_story: string | null
  key_life_events: string[] | null
  career_history: string | null
  past_relationships_summary: string | null

  // Relationships
  family_description: string | null
  close_friends_count: number | null
  social_style: string | null
  relationship_with_family: string | null

  // Lifestyle
  daily_routine: string | null
  sleep_schedule: string | null
  exercise_habits: string | null
  diet: string | null
  pets: string | null
  living_situation: string | null

  // Communication
  communication_style: string | null
  conversation_preferences: string[] | null
  texting_style: string | null
  response_speed: string | null

  // Goals
  short_term_goals: string[] | null
  long_term_goals: string[] | null
  what_seeking_in_others: string | null
  relationship_goal: string | null

  // Self
  self_description: string | null
  tags: string[] | null
}

export type CloneMemoryKind = 'event' | 'mood' | 'fact' | 'preference_update'

export interface CloneMemory {
  id: string
  clone_id: string
  kind: CloneMemoryKind
  content: string
  tags: string[]
  occurred_at: string   // ISO date
  created_at: string    // ISO datetime
  relevance_score: number | null
}

export interface Clone {
  id: string
  user_id: string | null
  is_npc: boolean
  is_public: boolean
  public_fields: string[] | null
  version: number
  name: string
  persona_json: Persona
  system_prompt: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
