import fs from 'fs'
import path from 'path'
import type { Alliance, FactionID, Unit, UnitType } from './units.js'

export const GameMode = {
  RAAS: 'RAAS',
  AAS: 'AAS',
  TC: 'Territory Control',
  Invasion: 'Invasion',
  Insurgency: 'Insurgency',
  Seed: 'Seed',
  TrackAttack: 'Track Attack',
  Skirmish: 'Skirmish',
  Destruction: 'Destruction',
  Tutorial: 'Tutorial',
  Training: 'Training',
  Unknown: 'Unknown',
} as const
export type GameMode = (typeof GameMode)[keyof typeof GameMode]

type UnitMapSize = 'Small' | 'Medium' | 'Large' | 'Unknown'
type Lighting =
  | 'Morning'
  | 'Daytime'
  | 'Afternoon'
  | 'Evening'
  | 'Overcast'
  | 'Sandstorm'
  | 'Unknown'

export const FOBType = {
  '01_Small': {
    displayName: 'Small FOB Radius',
    constructionRadius: 150000,
    exclusionRadius: 30000,
  },
  '02_Medium': {
    displayName: 'Medium FOB Radius',
    constructionRadius: 150000,
    exclusionRadius: 40000,
  },
}
export type FOBType = (typeof FOBType)[keyof typeof FOBType]

interface Team {
  tickets: number
  disabledVeh: boolean
  playerPercent: number
  defaultUnit: Unit
  allowedAlliances: Alliance[]
  allowedFactions: FactionID[]
  allowedUnitTypes: UnitType[]
  allowedUnits: Unit[]
}

export interface Layer {
  name: string
  className: string
  map: string
  gamemode: GameMode
  version: string
  size: UnitMapSize
  lighting: Lighting
  seaLevel: number
  heliAltThreshold: number
  mapDisplayName: string
  minimapTexture: string
  depthMapTexture: string
  FOBType: keyof typeof FOBType
  helicopters: boolean
  boats: boolean
  tanks: boolean
  commanderDisabled: boolean
  teamConfig: {
    team1: Team
    team2: Team
  }
}

export const LAYERS_FILE = path.resolve(
  import.meta.dirname,
  '../../data/layers.json'
)
export const LAYERS: Record<string, Layer> = JSON.parse(
  fs.readFileSync(LAYERS_FILE, 'utf-8')
)

export function getLayerByClassname(classname: string): Layer | undefined {
  return LAYERS[classname]
}
