import { type eosID, parseIDs } from '../../../common/online-ids.js'
import SquadLogParser, { type Rule } from '../log-parser.js'

declare module '../log-parser.js' {
  interface LogEvents {
    DEPLOYABLE_DAMAGED: {
      time: Date
      attackerEOSID?: eosID
      deployable: string
      weapon: string
      damage: number
      healthRemaining: number
    }
  }
}

export default {
  pattern:
    /^LogSquadTrace: \[DedicatedServer\]TakeDamage\(\): (?<deployable>[A-z0-9_]+_C_[0-9]+): (?<damage>[0-9.]+) damage taken by causer (?<weapon>[A-z0-9_]+)_C_[0-9]+ instigator (?<playerName>.+) \(Online IDs:(?<onlineIDs>[^)]+)\) health remaining (?<healthRemaining>[0-9.]+)/,
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    const healthRemaining = parseFloat(groups.healthRemaining)

    let attackerEOSID
    if (!groups.onlineIDs.includes('INVALID')) {
      attackerEOSID = parseIDs(groups.onlineIDs).eosID
    }

    logParser.events.emit('DEPLOYABLE_DAMAGED', {
      time: time,
      deployable: groups.deployable,
      attackerEOSID: attackerEOSID,
      weapon: groups.weapon,
      damage: parseFloat(groups.damage),
      healthRemaining: healthRemaining,
    })
  },
} as Rule
