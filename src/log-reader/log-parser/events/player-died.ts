import { type eosID, parseIDs } from '../../../common/online-ids.js'
import SquadLogParser, { type Rule } from '../log-parser.js'

declare module '../log-parser.js' {
  interface LogEvents {
    PLAYER_DIED: {
      time: Date
      attackerEOSID?: eosID
      victimName: string
      damage: number
      weapon: string
    }
  }
}

export default {
  pattern:
    /^LogSquadTrace: \[DedicatedServer\]Die\(\): Player:(?<victimName>.+) KillingDamage=-?(?<damage>[0-9.]+) from (?:[A-z_0-9]+) \(Online IDs:(?<attackerOnlineIDs>[^|]+)\| Contoller ID: (?<attackerController>[\w\d]+)\) caused by (?<weapon>[A-z_0-9-]+)_C/,
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    let attackerEOSID
    if (!groups.attackerOnlineIDs.includes('INVALID')) {
      attackerEOSID = parseIDs(groups.attackerOnlineIDs).eosID
    }

    logParser.events.emit('PLAYER_DIED', {
      time: time,
      attackerEOSID: attackerEOSID,
      victimName: groups.victimName,
      damage: parseFloat(groups.damage),
      weapon: groups.weapon,
    })
  },
} as Rule
