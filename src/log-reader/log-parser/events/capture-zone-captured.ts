import type { TeamID } from '../../../common/types.js'
import SquadLogParser, { type Rule } from '../log-parser.js'

declare module '../log-parser.js' {
  interface LogEvents {
    CAPTURE_ZONE_CAPTURED: {
      time: Date
      teamID: TeamID
      zone: string
    }
  }
}

// Example:
// [2026.10.01-12.00.00:000][123]LogSquad: Capture zone 03-Village was fully captured by team 2
export default {
  pattern:
    /^Log\w+: .*?Capture zone (?<zone>.+?) was fully captured by team (?<teamID>\d+)/,
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    logParser.events.emit('CAPTURE_ZONE_CAPTURED', {
      time: time,
      zone: groups.zone,
      teamID: +groups.teamID as TeamID,
    })
  },
} satisfies Rule
