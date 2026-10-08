import { type eosID, parseIDs } from '../../../common/online-ids.js'
import type { TeamID } from '../../../common/types.js'
import SquadLogParser, { type Rule } from '../log-parser.js'

declare module '../log-parser.js' {
  interface LogEvents {
    DEPLOYABLE_SPAWNED: {
      time: Date
      team: TeamID
      playerEOSID: eosID
      deployable: string
      deployableClassname: string
      location: { x: number; y: number; z: number }
    }
  }
}

// Example:
// [2026.10.01-12.00.00:000][123]LogSquad: Deployable BP_FOBRadio_Woodland_C_2147 spawned for team 1 at location {X=1.0,Y=2.0,Z=3.0} by player SomeName (ID: 42, OnlineIDs: EOS: 0002... steam: 7656...)
export default {
  pattern:
    /^LogSquad: Deployable (?<deployable>\S+) spawned for team (?<teamID>\d+) at location \{(?<location>[^}]*)\} by player (?<playerName>.+) \(ID: (?<playerID>\d+), OnlineIDs:(?<onlineIDs>[^)]*)\)/,
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    const onlineIDs = parseIDs(groups.onlineIDs)
    const coords = (
      groups.location.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) || []
    ).map(parseFloat)

    logParser.events.emit('DEPLOYABLE_SPAWNED', {
      time: time,
      team: +groups.teamID as TeamID,
      playerEOSID: onlineIDs.eosID,
      deployable: groups.deployable,
      deployableClassname: groups.deployable.replace(/_C_\d+$/, ''),
      location: { x: coords[0], y: coords[1], z: coords[2] },
    })
  },
} satisfies Rule
