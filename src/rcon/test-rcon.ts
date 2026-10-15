import {
  configure,
  getAnsiColorFormatter,
  getConsoleSink,
} from '@logtape/logtape'
import SquadRconClient, { type RconEvents } from './squad-rcon-client.js'

await configure({
  sinks: {
    console: getConsoleSink({ formatter: getAnsiColorFormatter() }),
  },
  loggers: [
    {
      category: [],
      lowestLevel: 'info',
      sinks: ['console'],
    },
  ],
})

const events: Record<keyof RconEvents, null> = {
  CHAT_MESSAGE: null,
  SQUAD_CREATED: null,
  SQUAD_DESTROYED: null,
  SQUAD_LEADER_CHANGED: null,
  PLAYER_CHANGED_ROLE: null,
  PLAYER_BECAME_SL: null,
  PLAYER_NO_LONGER_SL: null,
  PLAYER_CHANGED_SQUAD: null,
  PLAYER_CHANGED_TEAM: null,
  PLAYER_CONNECTED: null,
  PLAYER_DISCONNECTED: null,
  PLAYER_WARNED: null,
  PLAYER_KICKED: null,
  PLAYER_BANNED: null,
  POSSESSED_ADMIN_CAMERA: null,
  UNPOSSESSED_ADMIN_CAMERA: null,
  TICKET_COUNT_UPDATED: null,
  SQUAD_LOCKED: null,
  SQUAD_UNLOCKED: null,
  PLAYER_CHANGED_NAME: null,
  PLAYER_CHANGED_VEHICLE: null,
}

const eventNames = Object.keys(events) as (keyof RconEvents)[]

const host = process.env.RCON_HOST
const port = process.env.RCON_PORT ? +process.env.RCON_PORT : undefined
const password = process.env.RCON_PASSWORD

const client = new SquadRconClient()

for (const event of eventNames) {
  client.events.on(event, (payload: RconEvents[keyof RconEvents]) => {
    console.log(event, payload)
  })
}

await client.connect({ host, port, password, force: true })
