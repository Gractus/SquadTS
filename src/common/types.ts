import type { Layer } from '../game-info/layers.js'
import type { Unit } from '../game-info/units.js'
import type { OnlineIDs } from './online-ids.js'

/**
 * In game teams are referred to as Team 1 & Team 2.
 * For the sake of easy array indexing we're remapping to 0 & 1.
 */
export const TeamID = {
  team1: 0,
  team2: 1,
} as const
export type TeamID = (typeof TeamID)[keyof typeof TeamID]

export type SquadID = number

/**
 * IDs that persist outside of the game.
 * i.e. Still valid even after a player has disconnected.
 */
export interface ExternalIDs extends OnlineIDs {
  name: string
}

/**
 * IDs that exist in a match.
 */
export interface InGameIDs {
  playerID: number
  teamID: TeamID
  squadID?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToEventEmitterMap<T extends Record<string, any>> = {
  [K in keyof T]: [T[K]]
}

export interface MatchOutcome {
  layer: Layer
  start?: Date
  end: Date
  winner?: TeamID
  team1: { unit?: Unit; tickets: number }
  team2: { unit?: Unit; tickets: number }
}
