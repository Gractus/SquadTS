import type { TeamID } from '../../../common/types.js'
import SquadLogParser, { type Rule } from '../log-parser.js'

declare module '../log-parser.js' {
  interface LogEvents {
    CAPTURE_ZONE_NEUTRALIZED: {
      time: Date
      zone: string
      attackingTeam: TeamID
      owningTeam: TeamID
    }
  }
}

// Example:
// [2026.10.01-12.00.00:000][123]LogSquad: Capture zone 03-Village was neutralized by team 2 (was owned by team 1)
export default {
  pattern:
    /^Log\w+: .*?Capture zone (?<zone>.+?) was neutralized by team (?<attackingTeam>\d+) \(was owned by team (?<owningTeam>\d+)\)/,
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    logParser.events.emit('CAPTURE_ZONE_NEUTRALIZED', {
      time: time,
      zone: groups.zone,
      owningTeam: +groups.owningTeam as TeamID,
      attackingTeam: +groups.attackingTeam as TeamID,
    })
  },
} satisfies Rule
