import { type MatchOutcome, TeamID } from '../../../common/types.js'
import { getLayerByClassname, type Layer } from '../../../game-info/layers.js'
import { getUnit, type Unit } from '../../../game-info/units.js'
import SquadLogParser, { type Rule } from '../log-parser.js'

declare module '../log-parser.js' {
  interface LogEvents {
    MATCH_ENDED: MatchOutcome
  }
}

interface Team {
  unit?: Unit
  tickets: number
  won: boolean
}

export interface roundEndInterface {
  layer: Layer
  team1: Team
  team2: Team
}

const tickets: Rule = {
  pattern:
    /^LogSquadGameEvents: Display: Team (?<teamID>[0-9]), (?<subFaction>.*) \( ?(?<faction>.*?) ?\) has (?<result>won|lost) the match with (?<tickets>[0-9]+) Tickets on layer (?<layer>.*) \(level (?<level>.*)\)!/,
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    if (!logParser.eventStore.roundEnd) {
      logParser.eventStore.roundEnd = {}
    }

    const roundEnd = logParser.eventStore.roundEnd

    if (!roundEnd.layer) {
      const layer = getLayerByClassname(groups.layer)
      roundEnd.layer = layer
    }

    const unit: Unit = getUnit(groups.subFaction)

    const team = {
      unit: unit,
      tickets: +groups.tickets,
      won: groups.result === 'won',
    }

    const teamID = +groups.teamID === TeamID.team1 ? TeamID.team1 : TeamID.team2
    if (teamID === TeamID.team1) {
      roundEnd.team1 = team
    } else {
      roundEnd.team2 = team
    }
  },
}

const roundEnd: Rule = {
  pattern:
    /^LogGameState: Match State Changed from InProgress to WaitingPostMatch/,
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    const roundEnd = logParser.eventStore.roundEnd!
    // if (!roundEnd || !roundEnd.team1 || !roundEnd.team2) return;
    const layer = roundEnd.layer!
    const team1 = roundEnd.team1!
    const team2 = roundEnd.team2!

    let winner
    if (team1.won) {
      winner = TeamID.team1
    } else if (team2.won) {
      winner = TeamID.team2
    }

    const event = {
      start: time,
      end: time,
      layer: layer,
      winner: winner,
      team1: { unit: team1.unit, tickets: team1.tickets },
      team2: { unit: team2.unit, tickets: team2.tickets },
    }

    logParser.events.emit('MATCH_ENDED', event)
    logParser.eventStore.roundEnd = undefined
  },
}

export default [tickets, roundEnd]
