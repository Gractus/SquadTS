import {
  configure,
  getAnsiColorFormatter,
  getConsoleSink,
  getLogger,
} from '@logtape/logtape'
import { LocalLogReader } from './log-reader-local.js'
import type { LogEvents } from './log-parser/log-parser.js'

await configure({
  sinks: {
    console: getConsoleSink({ formatter: getAnsiColorFormatter() }),
  },
  loggers: [
    {
      category: [],
      lowestLevel: 'trace',
      sinks: ['console'],
    },
  ],
})

const events: Record<keyof LogEvents, null> = {
  ADMIN_BROADCAST: null,
  CAPTURE_ZONE_CAPTURED: null,
  CAPTURE_ZONE_NEUTRALIZED: null,
  DEPLOYABLE_DAMAGED: null,
  DEPLOYABLE_SPAWNED: null,
  MATCH_LOADED: null,
  MATCH_START: null,
  MATCH_ENDED: null,
  PLAYER_DAMAGED: null,
  PLAYER_WOUNDED: null,
  PLAYER_DIED: null,
  PLAYER_REVIVED: null,
  SERVER_TICK_RATE: null,
}

const eventNames = Object.keys(events) as (keyof LogEvents)[]

const reader = new LocalLogReader(
  'Y:/Program Files (x86)/Steam/steamapps/common/Squad Dedicated Server/SquadGame/Saved/Logs/SquadGame-backup-2026.10.11-03.00.32.log',
  getLogger()
)

for (const event of eventNames) {
  reader.events.on(event, (payload: LogEvents[keyof LogEvents]) => {
    console.log(event, payload)
  })
}

await reader.start()
