import fs from 'fs'
import { isDeepStrictEqual } from 'node:util'

import { type Layer, LAYERS_FILE } from '../game-info/layers.js'
import {
  Alliance,
  type Asset,
  type FactionID,
  type Unit,
  UNITS_FILE,
} from '../game-info/units.js'
import {
  type Vehicle,
  VEHICLE_FILE,
  type VehicleType,
} from '../game-info/vehicles.js'

// const DATA_URL = 'https://raw.githubusercontent.com/Squad-Wiki/squad-wiki-pipeline-map-data/master/completed_output/_Current%20Version/finished.json';
const DATA_URL =
  'https://raw.githubusercontent.com/Squad-Wiki/squad-wiki-pipeline-map-data/refs/heads/dev/completed_output/_Current%20Version/finished.json'

const VEHICLE_TYPE_OVERRIDES: Record<string, VehicleType> = {
  'LAV 6': 'IFV',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseUnits(input: Record<string, any>) {
  const vehicles: Record<string, Vehicle> = {}
  const units: Record<string, Unit> = {}

  for (const unit of Object.values(input)) {
    const assets: Asset[] = []
    for (const asset of unit.vehicles) {
      if (!vehicles[asset.rawType]) {
        vehicles[asset.rawType] = {
          displayName: asset.type,
          className: asset.rawType,
          icon: asset.icon,
          vehType: VEHICLE_TYPE_OVERRIDES[asset.type] ?? asset.vehType,
          spawnerSize: asset.spawnerSize,
        }
      }
      assets.push({
        vehicleClassName: asset.rawType,
        count: asset.count,
        delay: asset.delay,
        respawnTime: asset.respawnTime,
        singleUse: asset.singleUse,
      })
    }
    units[unit.unitObjectName] = {
      className: unit.unitObjectName,
      faction: unit.factionID,
      alliance: Alliance[unit.factionID as FactionID],
      displayName: unit.displayName,
      type: unit.type,
      useCommanderActionNearVehicle: unit.useCommanderActionNearVehicle,
      buddyRally: unit.hasBuddyRally,
      assets: assets,
    }
  }
  return { units, vehicles }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseLayers(layers: Record<string, any>) {
  const result: Record<string, Layer> = {}

  for (const layer of Object.values(layers)) {
    const team1 = layer.teamConfigs.team1
    const team2 = layer.teamConfigs.team2
    const factions = layer.teamConfigs.factions

    const team1Factions = []
    const team1Units = []
    for (const faction of factions.team1Units) {
      team1Factions.push(faction.factionID)
      for (const type of faction.types) {
        team1Units.push(type.unit)
      }
    }
    const team2Factions = []
    const team2Units = []
    for (const faction of factions.team2Units) {
      team2Factions.push(faction.factionID)
      for (const type of faction.types) {
        team2Units.push(type.unit)
      }
    }

    result[layer.rawName] = {
      name: layer.Name,
      className: layer.rawName,
      map: layer.mapId,
      gamemode: layer.gamemode,
      version: layer.layerVersion,
      size: layer.mapSizeType,
      lighting: layer.lighting,
      seaLevel: layer.seaLevel,
      heliAltThreshold: layer.heliAltThreshold,
      mapDisplayName: layer.mapName,
      minimapTexture: layer.minimapTexture,
      depthMapTexture: layer.depthMapTexture,
      FOBType: layer.FOBRadiusType,
      helicopters: layer.helicoptersAvailable,
      boats: layer.boatsAvailable,
      tanks: layer.tanksAvailable,
      commanderDisabled: layer.commanderDisabled,
      teamConfig: {
        team1: {
          tickets: team1.tickets,
          disabledVeh: team1.disabledVeh,
          playerPercent: team1.playerPercent,
          defaultUnit: team1.defaultFactionUnit,
          allowedAlliances: team1.allowedAlliances,
          allowedFactions: team1Factions,
          allowedUnitTypes: team1.allowedFactionUnitTypes,
          allowedUnits: team1Units,
        },
        team2: {
          tickets: team2.tickets,
          disabledVeh: team2.disabledVeh,
          playerPercent: team2.playerPercent,
          defaultUnit: team2.defaultFactionUnit,
          allowedAlliances: team2.allowedAlliances,
          allowedFactions: team2Factions,
          allowedUnitTypes: team2.allowedFactionUnitTypes,
          allowedUnits: team2Units,
        },
      },
    }
  }

  return result
}

const response = await fetch(DATA_URL)
if (!response.ok) {
  throw new Error(
    `Failed to retrieve data file: HTTP Status ${response.status} - ${response.statusText}`
  )
}
const result = await response.json()

const { units, vehicles } = parseUnits(result.Units)

if (fs.existsSync(UNITS_FILE)) {
  const oldUnits = JSON.parse(fs.readFileSync(UNITS_FILE, 'utf-8'))
  if (!isDeepStrictEqual(units, oldUnits)) {
    fs.writeFileSync(UNITS_FILE, JSON.stringify(units, null, 4), 'utf-8')
    console.log('Unit data file has been updated!')
    console.log('You should probably bump the package version!')
  } else {
    console.log('Unit data file already up to date.')
  }
} else {
  fs.writeFileSync(UNITS_FILE, JSON.stringify(units), 'utf-8')
  console.log('Unit data file has been created!')
}

if (fs.existsSync(VEHICLE_FILE)) {
  const oldVehicles = JSON.parse(fs.readFileSync(VEHICLE_FILE, 'utf-8'))
  if (!isDeepStrictEqual(vehicles, oldVehicles)) {
    fs.writeFileSync(VEHICLE_FILE, JSON.stringify(vehicles, null, 4), 'utf-8')
    console.log('Vehicles data file has been updated!')
    console.log('You should probably bump the package version!')
  } else {
    console.log('Vehicles data file already up to date.')
  }
} else {
  fs.writeFileSync(VEHICLE_FILE, JSON.stringify(vehicles), 'utf-8')
  console.log('Vehicles data file has been created!')
}

const layers = parseLayers(result.Maps)

if (fs.existsSync(LAYERS_FILE)) {
  const oldLayers = JSON.parse(fs.readFileSync(LAYERS_FILE, 'utf-8'))
  if (!isDeepStrictEqual(layers, oldLayers)) {
    fs.writeFileSync(LAYERS_FILE, JSON.stringify(layers, null, 4), 'utf-8')
    console.log('Layers data file has been updated!')
    console.log('You should probably bump the SquadJS version!')
  } else {
    console.log('Layers data file already up to date.')
  }
} else {
  fs.writeFileSync(LAYERS_FILE, JSON.stringify(layers), 'utf-8')
  console.log('Layers data file has been created!')
}
