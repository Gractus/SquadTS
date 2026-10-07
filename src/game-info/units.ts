import { readFileSync } from 'fs'
import path from 'path'
import type { Vehicle } from './vehicles.js'

type PossibleAlliances = 'BLUFOR' | 'PAC' | 'REDFOR' | 'INDEPENDENT' | 'Unknown'

export const Alliance: Record<FactionID, PossibleAlliances> = {
  ADF: 'BLUFOR',
  BAF: 'BLUFOR',
  CAF: 'BLUFOR',
  GFI: 'REDFOR',
  MEI: 'INDEPENDENT',
  PLA: 'PAC',
  RGF: 'REDFOR',
  USMC: 'BLUFOR',
  USA: 'BLUFOR',
  VDV: 'REDFOR',
  WPMC: 'INDEPENDENT',
  Unknown: 'Unknown',
} as const
export type Alliance = (typeof Alliance)[keyof typeof Alliance]

export type FactionID =
  | 'ADF'
  | 'BAF'
  | 'CAF'
  | 'GFI'
  | 'MEI'
  | 'PLA'
  | 'RGF'
  | 'USMC'
  | 'USA'
  | 'VDV'
  | 'WPMC'
  | 'Unknown'

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

export function getUnit(className?: string, displayName?: string): Unit {
  return (
    Object.values(UNITS).find(
      unit => unit.className === className || unit.displayName === displayName
    ) ?? {
      faction: 'Unknown',
      alliance: 'Unknown',
      className: className ? className : 'Unknown',
      displayName: displayName ? displayName : 'Unknown',
      type: 'Unknown',
      assets: [],
    }
  )
}
