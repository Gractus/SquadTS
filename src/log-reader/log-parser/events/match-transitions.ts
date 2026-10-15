import { TeamID } from '../../../common/types.js'
import { getLayerByDisplayName } from '../../../game-info/layers.js'
import SquadLogParser, { type Rule } from '../log-parser.js'

declare module '../log-parser.js' {
  interface LogEvents {
    MATCH_LOADED: {
      time: Date
      layerClassname?: string
    }
    MATCH_START: {
      time: Date
      layerClassname?: string
    }
    MATCH_ENDED: {
      layerClassname?: string
      start?: Date
      end: Date
      forcedEnd: boolean
      winner?: TeamID
      team1?: MatchEndTeam
      team2?: MatchEndTeam
    }
  }
}

interface MatchEndTeam {
  factionName: string
  subFactionName: string
  tickets: number
  won: boolean
}

export interface Match {
  start: Date
  layer: string
  team1: MatchEndTeam
  team2: MatchEndTeam
}

// LogWorld: Bringing World /Game/Maps/Fallujah_City/Gameplay_Layers/Fallujah_RAAS_v1.Fallujah_RAAS_v1 up for play (max tick rate 64) at 2026.09.19-12.22.22
// OR
// LogWorld: Bringing World /Game/Maps/TransitionMap.TransitionMap up for play (max tick rate 64) at 2026.09.19-13.13.49

const movingToLayer = {
  pattern:
    /^LogWorld: Bringing World \/(?<dlc>[A-z0-9]+)\/(?:Maps\/)?(?<mapClassname>[A-z0-9-]+)\/(?:.+\/)?(?<layerClassname>[A-z0-9-]+)(?:\.[A-z0-9-]+)/,
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    // Skip "TransitionMap" events
    if (groups.layerClassname === 'TransitionMap') return

    logParser.clearMatch()
    logParser.eventStore.match.layer = groups.layerClassname
  },
} as Rule

const matchStaging = {
  pattern:
    /^LogGameMode: Display: Match State Changed from EnteringMap to WaitingToStart/,
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    logParser.events.emit('MATCH_LOADED', {
      time: time,
      layerClassname: logParser.eventStore.match.layer,
    })

    logParser.eventStore.match.start = time
  },
} as Rule

const matchStart = {
  pattern:
    /^LogGameState: Match State Changed from WaitingToStart to InProgress/,
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    logParser.events.emit('MATCH_START', {
      time: time,
      layerClassname: logParser.eventStore.match.layer,
    })
  },
} as Rule

const tickets: Rule = {
  pattern:
    /^LogSquadGameEvents: Display: Team (?<teamID>[0-9]), (?<subFaction>.*) \( ?(?<faction>.*?) ?\) has (?<result>won|lost) the match with (?<tickets>[0-9]+) Tickets on layer (?<layerDisplayName>.*) \(level (?<level>.*)\)!/,
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    const roundEnd = logParser.eventStore.match

    const layerClassname = getLayerByDisplayName(
      groups.layerDisplayName
    )?.className
    if (!layerClassname)
      logParser.log
        .error`Couldn't find layerClassname for layer: ${groups.layerDisplayName}`

    if (roundEnd.layer !== layerClassname) {
      logParser.log
        .error`Mismatch on round start layer and round end layer - Start layer: ${roundEnd.layer} End: ${layerClassname}.`
    }

    if (layerClassname) roundEnd.layer = layerClassname
    else if (roundEnd.layer)
      logParser.log
        .warn`Round end layerClassname couldn't be resolved, falling back to layerClassname ${roundEnd.layer} found at the start of the match and proceeding with that.`
    else {
      logParser.log
        .warn`Proceeding with unknown layer displayName: '${groups.layerDisplayName}' to do the best we can with what we got.`
      roundEnd.layer = groups.layerDisplayName
    }

    const team = {
      factionName: groups.faction,
      subFactionName: groups.subFaction,
      tickets: +groups.tickets,
      won: groups.result === 'won',
    } satisfies MatchEndTeam

    const teamID = groups.teamID === '1' ? TeamID.team1 : TeamID.team2
    if (teamID === TeamID.team1) {
      roundEnd.team1 = team
    } else {
      roundEnd.team2 = team
    }
  },
}

const matchEnd: Rule = {
  pattern:
    /^LogGameState: Match State Changed from InProgress to WaitingPostMatch/,
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    const { layer, start, team1, team2 } = logParser.eventStore.match

    let forcedEnd = false
    let winner
    if (!team1 || !team2) {
      forcedEnd = true
    } else {
      if (team1.won) {
        winner = TeamID.team1
      } else if (team2.won) {
        winner = TeamID.team2
      }
    }

    logParser.events.emit('MATCH_ENDED', {
      layerClassname: layer,
      start: start,
      end: time,
      forcedEnd: forcedEnd,
      winner: winner,
      team1: team1,
      team2: team2,
    })
  },
}

export default [movingToLayer, matchStaging, matchStart, tickets, matchEnd]
