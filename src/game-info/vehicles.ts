import fs from 'fs'
import path from 'path'

export const VEHICLE_FILE = path.resolve(
  import.meta.dirname,
  '../data/vehicles.json'
)

export interface Vehicle {
  displayName: string
  className: string
  icon: string
  vehType: VehicleType
  spawnerSize: SpawnerSize
}

/** Internal SquadJS definitions since SquadPipe definitions are inconsistent. */
export type VehicleType =
  | 'Heli'
  | 'IFV'
  | 'Boat'
  | 'Transport'
  | 'Logi'
  | 'APC'
  | 'Tank'
  | 'ATGM'
  | 'Unknown'

type SpawnerSize = 'APC' | 'Car' | 'QuadBike' | 'Boat' | 'MBT' | 'Helicopter'

export const VEHICLES: Record<string, Vehicle> = JSON.parse(
  fs.readFileSync(VEHICLE_FILE, 'utf8')
)

export function getVehicle(className?: string, displayName?: string) {
  let vehicle
  if (className) {
    vehicle = VEHICLES[className]
    if (vehicle) return vehicle
  }
  if (displayName) {
    const matches = Object.values(VEHICLES).filter(
      vehicle => vehicle.displayName === displayName
    )
    if (matches.length === 1) {
      return matches[0]
    }
    return matches
  }
  return vehicle
}
export function getVehicleByClassname(classname: string): Vehicle | undefined {
  return VEHICLES[classname]
}

export function getVehiclesByName(name: string): Vehicle[] {
  return Object.values(VEHICLES).filter(vehicle => vehicle.displayName === name)
}
