import SquadLogParser, { type Rule } from '../log-parser.js'

declare module '../log-parser.js' {
  interface LogEvents {
    SERVER_TICK_RATE: {
      time: Date
      tickRate: number
    }
  }
}

export default {
  pattern: /^LogSquad: USQGameState: Server Tick Rate: (?<tickRate>[0-9.]+)/,
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    logParser.events.emit('SERVER_TICK_RATE', {
      time: time,
      tickRate: parseFloat(groups.tickRate),
    })
  },
} as Rule
