import { type eosID, parseIDs } from '../../../common/online-ids.js'
import SquadLogParser, { type Rule } from '../log-parser.js'

declare module '../log-parser.js' {
  interface LogEvents {
    PLAYER_DAMAGED: {
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
    /^LogSquad: Player: (?<victimName>.+) ActualDamage=(?<damage>\d+.\d{6}) from (?<attackerName>.+) \(Online IDs:(?<attackerOnlineIDs>[^|]+)\| Player Controller ID: (?<attackerController>BP_PlayerController_[^ ]+)\)caused by (?<weapon>[A-z_0-9-]+)_C/,
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    const attackerEOSID = parseIDs(groups.attackerOnlineIDs).eosID

    logParser.events.emit('PLAYER_DAMAGED', {
      time: time,
      attackerEOSID: attackerEOSID,
      victimName: groups.victimName,
      damage: parseFloat(groups.damage),
      weapon: groups.weapon,
    })
  },
} as Rule
