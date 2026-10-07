import { type eosID, parseIDs } from '../../../common/online-ids.js'
import SquadLogParser, { type Rule } from '../log-parser.js'

declare module '../log-parser.js' {
  interface LogEvents {
    PLAYER_REVIVED: {
      time: Date
      reviverEOSID: eosID
      targetEOSID: eosID
    }
  }
}

export default {
  pattern:
    /^LogSquad: (?<reviverName>.+) \(Online IDs:(?<reviverOnlineIDs>[^)]+)\) has revived (?<targetName>.+) \(Online IDs:(?<targetOnlineIDs>[^)]+)\)\./,
  action: (
    time: Date,
    chainID: number,
    args: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    const reviverOnlineIDs = parseIDs(args.reviverOnlineIDs)
    const targetOnlineIDs = parseIDs(args.targetOnlineIDs)

    logParser.events.emit('PLAYER_REVIVED', {
      time: time,
      reviverEOSID: reviverOnlineIDs.eosID,
      targetEOSID: targetOnlineIDs.eosID,
    })
  },
} as Rule
