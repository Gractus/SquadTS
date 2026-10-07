import { type eosID, parseIDs } from '../../../common/online-ids.js'
import SquadLogParser, { type Rule } from '../log-parser.js'

declare module '../log-parser.js' {
  interface LogEvents {
    ADMIN_BROADCAST: {
      time: Date
      message: string
      adminEOSID?: eosID
    }
  }
}

export default {
  pattern:
    /^LogSquad: ADMIN COMMAND: Message broadcasted <(?<message>.+)> from (?<from>RCON|(?:player \d+\. \[Online IDs=(?<onlineIDs>[^\]]+)\] {2}(?<adminName>.*)))/,
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    let adminEOSID
    if (groups.onlineIDs) {
      adminEOSID = parseIDs(groups.onlineIDs).eosID
    }
    logParser.events.emit('ADMIN_BROADCAST', {
      time: time,
      message: groups.message,
      adminEOSID: adminEOSID,
    })
  },
} as Rule
