import { readFileSync } from 'fs'
import path from 'path'
import { getLayerByClassname } from './layers.js'
import type { Vehicle } from './vehicles.js'

type PossibleAlliances = 'BLUFOR' | 'PAC' | 'REDFOR' | 'INDEPENDENT' | 'Unknown'

export const Alliance: Record<FactionID, PossibleAlliances> = {
  ADF: 'BLUFOR',
  BAF: 'BLUFOR',
  CAF: 'BLUFOR',
  GFI: 'REDFOR',
  MEI: 'INDEPENDENT',
  PLA: 'PAC',
  PLANMC: 'PAC',
  PLAAGF: 'PAC',
  RGF: 'REDFOR',
  USMC: 'BLUFOR',
  USA: 'BLUFOR',
  VDV: 'REDFOR',
  WPMC: 'INDEPENDENT',
  Unknown: 'Unknown',
} as const
export type Alliance = (typeof Alliance)[keyof typeof Alliance]

export const FactionID = {
  'Australian Defence Force': 'ADF',
  'British Armed Forces': 'BAF',
  'Canadian Armed Forces': 'CAF',
  'Ground Forces of Iran': 'GFI',
  'Middle Eastern Insurgents': 'MEI',
  "People's Liberation Army": 'PLA',
  'PLA Amphibious Ground Forces': 'PLAAGF',
  'PLA Navy Marine Corps': 'PLANMC',
  'Russian Ground Forces': 'RGF',
  'United States Marine Corps': 'USMC',
  'United States Army': 'USA',
  'Russian Airborne Forces': 'VDV',
  'Western Private Military Contractors': 'WPMC',
  '': 'Unknown',
} as const
export type FactionID = (typeof FactionID)[keyof typeof FactionID]
export type FactionName = keyof typeof FactionID

export type UnitType =
  | 'Combined Arms'
  | 'Mechanized (Wheeled)'
  | 'Infantry (Air Mobile)'
  | 'Armored'
  | 'Mechanized'
  | 'Support'
  | 'Special Forces'
  | 'Armored Recon (Wheeled)'
  | 'Mountain Infantry'
  | 'Light Infantry'
  | 'Mechanized (Wheeled Amphibious)'
  | 'Mechanized (Amphibious + MGS)'
  | 'Mechanized (Wheeled MGS)'
  | 'Motorized'
  | 'Support (MLRS)'
  | 'Recon Infantry'
  | 'Mechanized (MGS)'
  | 'Unknown'

export interface Asset {
  vehicleClassName: Vehicle
  count: number
  delay: number
  respawnTime: number
  singleUse: boolean
}

export interface Unit {
  faction: FactionID
  alliance: Alliance
  className: string
  displayName: string
  type: UnitType
  useCommanderActionNearVehicle?: boolean
  buddyRally?: boolean
  assets: Asset[]
}

export const UNITS_FILE = path.resolve(
  import.meta.dirname,
  '../../data/units.json'
)
export const UNITS: Record<string, Unit> = JSON.parse(
  readFileSync(UNITS_FILE, 'utf8')
)

export function getUnitByClassName(className: string) {
  return UNITS[className]
}

export function getUnit(
  layerClassname: string,
  factionName: string,
  displayName: string
) {
  const layer = getLayerByClassname(layerClassname)
  if (!layer) return
  const teamConfig = layer.teamConfig
  for (const unitClassname of teamConfig.team1.allowedUnits) {
    const candidateUnit = UNITS[unitClassname]
    if (
      candidateUnit &&
      candidateUnit.faction === factionName &&
      candidateUnit.displayName === displayName
    )
      return candidateUnit
  }
  for (const unitClassname of teamConfig.team2.allowedUnits) {
    const candidateUnit = UNITS[unitClassname]
    if (
      candidateUnit &&
      candidateUnit.faction === factionName &&
      candidateUnit.displayName === displayName
    )
      return candidateUnit
  }
}
