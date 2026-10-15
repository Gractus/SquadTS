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
  layerClassname?: string
  /** Match ended due to forced map change or other admin action. */
  forcedEnd: boolean
  start?: Date
  end: Date
  /** `undefined` if draw or the forcedEnd is `true` */
  winner?: TeamID
  team1?: {
    faction?: string
    subFaction?: string
    unitClassname?: string
    tickets: number
  }
  team2?: {
    faction?: string
    subFaction?: string
    unitClassname?: string
    tickets: number
  }
}
