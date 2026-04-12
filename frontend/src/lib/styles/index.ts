import type { StyleCard } from './types'

import { card as formalPoliteYoung } from './cards/formal_polite_young'
import { card as formalPoliteMature } from './cards/formal_polite_mature'
import { card as casualCloseFemale } from './cards/casual_close_female'
import { card as casualCloseMale } from './cards/casual_close_male'
import { card as mixedWarmingUp } from './cards/mixed_warming_up'
import { card as defaultCasual } from './cards/default_casual'

const ALL_CARDS: StyleCard[] = [
  formalPoliteYoung,
  formalPoliteMature,
  casualCloseFemale,
  casualCloseMale,
  mixedWarmingUp,
  defaultCasual,
]

export function getAllStyleCards(): StyleCard[] {
  return ALL_CARDS
}
