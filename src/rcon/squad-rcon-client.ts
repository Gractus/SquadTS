import EventEmitter from 'events'

import Logger from '../common/logger.js'

import { parseIDs, type OnlineIDs } from '../common/online-ids.js'
import {
  TeamID,
  type ExternalIDs,
  type SquadID,
  type ToEventEmitterMap,
} from '../common/types.js'
import { getLayerByClassname, type Layer } from '../game-info/layers.js'
import { getUnit, type Unit } from '../game-info/units.js'
import { PlayerStore, type Player } from './player-store.js'
import SquadRconCore, { type RconOptions } from './squad-rcon-core.js'

interface PlayerList {
  time: Date
  players: PlayerListEntry[]
}

export interface PlayerListEntry extends OnlineIDs {
  playerID: number
  teamID: TeamID
  squadID?: number
  partyID?: string
  name: string
  isLeader: boolean
  role: string
  vehicle?: Vehicle
}

export interface Vehicle {
  type: string
  position: string
}

interface GetSquadsResult {
  time: Date
  squads: SquadListEntry[]
  tickets: Record<TeamID, number>
}

export interface SquadListEntry {
  teamID: TeamID
  teamName: string
  squadID: number
  name: string
  size: number
  locked: boolean
  creator: ExternalIDs
}

export interface ServerBrowserInfo {
  serverName: string
  maxPlayers: number
  reserveSlots: number
  reserveQueue: number
  publicQueue: number
  publicQueueLimit: number
  playerCount: number
  currentLayer?: Layer
  nextLayer?: Layer
  teamOne?: Unit
  teamTwo?: Unit
  matchTimeout: number
  matchStartTime: Date
  gameVersion: string
}

/** 0 = Perm | 5m = 5 minutes | 5d = 5 Days | 5M = 5 Months */
type BanLength = 0 | `${number}m` | `${number}d` | `${number}M`

export const ChatChannel = {
  all: 'ALL',
  team: 'TEAM',
  squad: 'SQUAD',
  admin: 'ADMIN',
} as const
export type ChatChannel = (typeof ChatChannel)[keyof typeof ChatChannel]

export interface RconEvents {
  CHAT_MESSAGE: {
    time: Date
    channel: ChatChannel
    message: string
    player: ExternalIDs
  }
  TICKET_COUNT_UPDATED: {
    time: Date
    team1: number
    team2: number
  }
  SQUAD_CREATED: {
    time: Date
    teamID: TeamID
    squadID: number
    name: string
    locked: boolean
    creator: ExternalIDs
  }
  SQUAD_DESTROYED: {
    time: Date
    teamID: TeamID
    squadID: number
    name: string
    creator: ExternalIDs
  }
  SQUAD_LEADER_CHANGED: {
    time: Date
    teamID: TeamID
    squadID: SquadID
    newLeader: Readonly<Player>
    oldLeader: Readonly<Player>
  }
  SQUAD_LOCKED: {
    time: Date
    teamID: TeamID
    squadID: SquadID
  }
  SQUAD_UNLOCKED: {
    time: Date
    teamID: TeamID
    squadID: SquadID
  }
  PLAYER_CHANGED_NAME: {
    time: Date
    player: Readonly<Player>
    newName: string
    oldName?: string
  }
  PLAYER_CHANGED_VEHICLE: {
    time: Date
    player: Readonly<Player>
    oldVehicle?: Vehicle
  }
  /**
   * Warning! Known Bug! If a player is not spawned in, joins a squad, then leaves it, then joins a new squad, their role won't update until they spawn in.
   */
  PLAYER_CHANGED_ROLE: {
    time: Date
    player: Readonly<Player>
    newRole: string
    oldRole?: string
  }
  PLAYER_BECAME_SL: {
    time: Date
    teamID: TeamID
    squadID: SquadID
    player: Readonly<Player>
  }
  /**
   * Warning! This event will not trigger if the player disconnects.
   */
  PLAYER_NO_LONGER_SL: {
    time: Date
    teamID: TeamID
    squadID?: SquadID
    player: Readonly<Player>
  }
  PLAYER_CHANGED_SQUAD: {
    time: Date
    player: Readonly<Player>
    oldSquadID?: number
    newSquadID?: number
  }
  PLAYER_CHANGED_TEAM: {
    time: Date
    player: Readonly<Player>
    newTeamID: TeamID
    oldTeamID?: TeamID
  }
  PLAYER_CONNECTED: {
    time: Date
    player: Readonly<Player>
  }
  PLAYER_DISCONNECTED: {
    connected: Date
    disconnected: Date
    player: ExternalIDs
  }
  PLAYER_WARNED: {
    time: Date
    playerName: string
    reason: string
  }
  PLAYER_KICKED: {
    time: Date
    playerID: string
    player: ExternalIDs
  }
  PLAYER_BANNED: {
    time: Date
    playerID: number
    player: ExternalIDs
    interval: number
  }
  POSSESSED_ADMIN_CAMERA: {
    time: Date
    player: ExternalIDs
  }
  UNPOSSESSED_ADMIN_CAMERA: {
    time: Date
    player: ExternalIDs
  }
}

export interface RconClientOptions extends RconOptions {
  autoUpdatePlayerStore?: boolean
  autoUpdatePlayerStoreInterval?: number
}

export default class SquadRconClient extends SquadRconCore {
  events = new EventEmitter<ToEventEmitterMap<RconEvents>>()
  autoUpdatePlayerStore: boolean
  autoUpdatePlayerStoreInterval: number
  autoUpdatePlayerStoreTimeout: NodeJS.Timeout | undefined = undefined
  playerStore: PlayerStore = new PlayerStore(this)

  constructor(options: RconClientOptions) {
    super(options)
    this.autoUpdatePlayerStore = options.autoUpdatePlayerStore ?? true
    this.autoUpdatePlayerStoreInterval =
      options.autoUpdatePlayerStoreInterval ?? 1000
    this.updatePlayerStore = this.updatePlayerStore.bind(this)
  }

  processRconEvent(contents: string) {
    const matchChat = contents.match(
      /\[Chat(?<channel>All|Team|Squad|Admin)] \[Online IDs:(?<onlineIDs>[^\]]+)\] (?<name>.+?) : (?<message>.*)/
    )
    if (matchChat?.groups) {
      Logger.debug(`Matched chat message: ${contents}`)

      let chatChannel!: ChatChannel
      switch (matchChat.groups.channel) {
        case 'All':
          chatChannel = ChatChannel.all
          break
        case 'Team':
          chatChannel = ChatChannel.team
          break
        case 'Squad':
          chatChannel = ChatChannel.squad
          break
        case 'Admin':
          chatChannel = ChatChannel.admin
      }

      const result: RconEvents['CHAT_MESSAGE'] = {
        time: new Date(),
        channel: chatChannel,
        message: matchChat.groups.message,
        player: {
          name: matchChat.groups.name,
          ...parseIDs(matchChat.groups.onlineIDs),
        },
      }
      this.events.emit('CHAT_MESSAGE', result)
      return
    }

    const matchWarn = contents.match(
      /Remote admin has warned player (?<name>.*)\. Message was "(?<message>.*)"/
    )
    if (matchWarn?.groups) {
      Logger.debug(`Matched warn message: ${contents}`)
      const result: RconEvents['PLAYER_WARNED'] = {
        time: new Date(),
        playerName: matchWarn.groups.name,
        reason: matchWarn.groups.message,
      }
      this.events.emit('PLAYER_WARNED', result)
      return
    }

    const matchPossessedAdminCam = contents.match(
      /\[Online Ids:(?<onlineIDs>[^\]]+)\] (?<name>.+) has possessed admin camera\./
    )
    if (matchPossessedAdminCam?.groups) {
      Logger.debug(`Matched admin camera possessed: ${contents}`)
      const result: RconEvents['POSSESSED_ADMIN_CAMERA'] = {
        time: new Date(),
        player: {
          name: matchPossessedAdminCam.groups.name,
          ...parseIDs(matchPossessedAdminCam.groups.onlineIDs),
        },
      }
      this.events.emit('POSSESSED_ADMIN_CAMERA', result)
      return
    }

    const matchUnpossessedAdminCam = contents.match(
      /\[Online IDs:(?<onlineIDs>[^\]]+)\] (?<name>.+) has unpossessed admin camera\./
    )
    if (matchUnpossessedAdminCam?.groups) {
      Logger.debug(`Matched admin camera unpossessed: ${contents}`)
      const result: RconEvents['UNPOSSESSED_ADMIN_CAMERA'] = {
        time: new Date(),
        player: {
          name: matchUnpossessedAdminCam.groups.name,
          ...parseIDs(matchUnpossessedAdminCam.groups.onlineIDs),
        },
      }
      this.events.emit('UNPOSSESSED_ADMIN_CAMERA', result)
      return
    }

    const matchSqCreated = contents.match(
      /(?<playerName>.+) \(Online IDs:(?<onlineIDs>[^)]+)\) has created Squad (?<squadID>\d+) \(Squad Name: (?<squadName>.+)\) on (?<teamName>.+)/
    )
    if (matchSqCreated?.groups) {
      // Ignore this event since we prefer to use the player store based method of recognising squad creation/destruction.
      return
      // Logger.verbose('SquadRcon', 4, `Matched Squad Created: ${contents}`);
      // const result: RconEvents['SQUAD_CREATED'] = {
      //   time: new Date(),
      //   playerName: matchSqCreated.groups.playerName,
      //   squadID: +matchSqCreated.groups.squadID,
      //   teamName: matchSqCreated.groups.teamName,
      //   squadName: matchSqCreated.groups.squadName,
      //   onlineIDs: parseIDs(matchSqCreated.groups.onlineIDs),
      // };
      // this.events.emit('SQUAD_CREATED', result);
      // return;
    }

    const matchKick = contents.match(
      /Kicked player (?<playerID>[0-9]+)\. \[Online IDs=(?<onlineIDs>[^\]]+)\] (?<name>.*)/
    )
    if (matchKick?.groups) {
      Logger.debug(`Matched kick message: ${contents}`)

      const result: RconEvents['PLAYER_KICKED'] = {
        time: new Date(),
        playerID: matchKick.groups.playerID,
        player: {
          name: matchKick.groups.name,
          ...parseIDs(matchKick.groups.onlineIDs),
        },
      }
      this.events.emit('PLAYER_KICKED', result)
      return
    }

    const matchBan = contents.match(
      /Banned player (?<playerID>[0-9]+)\. \[Online IDs=(?<onlineIDs>[^\]]+)\] (?<name>.*) for interval (?<interval>.*)/
    )
    if (matchBan?.groups) {
      Logger.debug(`Matched ban message: ${contents}`)

      const result: RconEvents['PLAYER_BANNED'] = {
        time: new Date(),
        playerID: +matchBan.groups.playerID,
        player: {
          name: matchBan.groups.name,
          ...parseIDs(matchBan.groups.onlineIDs),
        },
        interval: +matchBan.groups.interval,
      }
      this.events.emit('PLAYER_BANNED', result)
    }
  }

  async getCurrentMap(): Promise<Layer | undefined> {
    const response = await this.executeCommand('ShowCurrentMap')
    const match = response.match(
      /^Current level is (?<level>[^,]*), layer is (?<layer>[^,]*)/
    )
    if (match?.groups) {
      return getLayerByClassname(match.groups.layer)
    } else {
      throw new Error(
        'Received malformed response to ShowCurrentMap RCON command.'
      )
    }
  }

  async getNextMap(): Promise<Layer | undefined> {
    const response = await this.executeCommand('ShowNextMap')
    const match = response.match(
      /^Next level is (?<level>[^,]*), layer is (?<layer>[^,]*)/
    )
    if (match?.groups) {
      return getLayerByClassname(match.groups.layer)
    } else {
      throw new Error(
        'Received malformed response to ShowNextMap RCON command.'
      )
    }
  }

  async getListPlayers(): Promise<PlayerList> {
    const response = await this.executeCommand('ListPlayers')

    const players: PlayerListEntry[] = []

    if (!response || response.length < 1)
      return { time: new Date(), players: [] }

    for (const line of response.split('\n')) {
      const match = line.match(
        /^ID: (?<playerID>\d+) \| Online IDs:(?<onlineIDs>[^|]+)\| Name: (?<name>.+) \| Team ID: (?<teamID>\d|N\/A) \| Party ID: (?<partyID>\d+|N\/A) \| Squad ID: (?<squadID>\d+|N\/A) \| Is Leader: (?<isLeader>True|False) \| Role: (?<role>[^|]+) \| Vehicle: (?:(?:N\/A)|(?<vehicle>[\w-]+) \((?<vehiclePosition>[^)]*)\))$/
      )
      if (match?.groups) {
        if (match.groups.teamID === 'N/A') continue
        let vehicle: Vehicle | undefined
        if (match.groups.vehicle) {
          vehicle = {
            type: match.groups.vehicle,
            position: match.groups.vehiclePosition,
          }
        }
        const entry: PlayerListEntry = {
          playerID: +match.groups.playerID,
          teamID: match.groups.teamID === '1' ? TeamID.team1 : TeamID.team2,
          squadID:
            match.groups.squadID !== 'N/A' ? +match.groups.squadID : undefined,
          partyID:
            match.groups.partyID !== 'N/A' ? match.groups.partyID : undefined,
          role: match.groups.role,
          isLeader: match.groups.isLeader === 'True',
          name: match.groups.name,
          vehicle: vehicle,
          ...parseIDs(match.groups.onlineIDs),
        }
        players.push(entry)
      }
    }
    return { time: new Date(), players: players }
  }

  async getSquads(): Promise<GetSquadsResult> {
    const response = await this.executeCommand('ListSquads')
    const time = new Date()
    const tickets: Record<TeamID, number> = [0, 0]
    const squads: SquadListEntry[] = []
    let teamName!: string
    let teamID!: TeamID

    for (const line of response.split('\n')) {
      const matchPlayer = line.match(
        /^ID: (?<squadID>\d+) \| Name: (?<squadName>.+) \| Size: (?<size>\d+) \| Locked: (?<locked>True|False) \| Creator Name: (?<creatorName>.+) \| Creator Online IDs:(?<onlineIDs>[^|]+)/
      )
      const matchTeam = line.match(
        /Team ID: (?<teamID>\d) \((?<teamName>.+)\) - Tickets: (?<tickets>\d+)/
      )
      if (matchTeam?.groups) {
        teamID = matchTeam.groups.teamID === '1' ? TeamID.team1 : TeamID.team2
        teamName = matchTeam.groups.teamName
        tickets[teamID] = +matchTeam.groups.tickets
      }
      if (matchPlayer?.groups) {
        const squad: SquadListEntry = {
          teamID: teamID,
          teamName: teamName,
          squadID: +matchPlayer.groups.squadID,
          name: matchPlayer.groups.squadName,
          size: +matchPlayer.groups.size,
          locked: matchPlayer.groups.locked === 'True' ? true : false,
          creator: {
            name: matchPlayer.groups.creatorName,
            ...parseIDs(matchPlayer.groups.onlineIDs),
          },
        }
        squads.push(squad)
      }
    }

    this.events.emit('TICKET_COUNT_UPDATED', {
      time,
      team1: tickets[TeamID.team1],
      team2: tickets[TeamID.team2],
    })

    return { time, squads, tickets }
  }

  async warn(id: string | number, message: string) {
    await this.executeCommand(`AdminWarn "${id}" ${message}`)
  }

  async kick(id: string | number, reason: string) {
    await this.executeCommand(`AdminKick "${id}" ${reason}`)
  }

  async ban(id: string, banLength: BanLength, message: string) {
    await this.executeCommand(`AdminBan "${id}" ${banLength} ${message}`)
  }

  async banByPlayerID(id: number, banLength: BanLength, message: string) {
    await this.executeCommand(`AdminBanById "${id}" ${banLength} ${message}`)
  }

  async switchTeam(id: string | number) {
    await this.executeCommand(`AdminForceTeamChange "${id}"`)
  }

  async broadcast(message: string) {
    await this.executeCommand(`AdminBroadcast ${message}`)
  }

  async setFogOfWar(mode: 0 | 1) {
    await this.executeCommand(`AdminSetFogOfWar ${mode}`)
  }

  async getServerBrowserInfo(): Promise<ServerBrowserInfo> {
    const response = await this.executeCommand(`ShowServerInfo`)
    const data = JSON.parse(response)
    const result: ServerBrowserInfo = {
      serverName: data.ServerName_s,
      gameVersion: data.GameVersion_s,

      maxPlayers: +data.MaxPlayers,
      reserveSlots: +data.PlayerReserveCount_I,
      reserveQueue: +data.ReservedQueue_I,
      publicQueue: +data.PublicQueue_I,
      publicQueueLimit: +data.PublicQueueLimit_I,

      playerCount: +data.PlayerCount_I,

      currentLayer: getLayerByClassname(data.MapName_s),
      nextLayer: getLayerByClassname(data.NextLayer_s),

      matchTimeout: +data.MatchTimeout_d,
      matchStartTime: new Date(Date.now() - +data.PLAYTIME_I * 1000),

      teamOne: getUnit(
        data.TeamOne_s?.replace(new RegExp(data.MapName_s, 'i'), '') || ''
      ),
      teamTwo: getUnit(
        data.TeamTwo_s?.replace(new RegExp(data.MapName_s, 'i'), '') || ''
      ),
    }
    return result
  }

  async updatePlayerStore() {
    clearTimeout(this.autoUpdatePlayerStoreTimeout)
    try {
      await this.playerStore.update()
    } finally {
      if (this.autoUpdatePlayerStore) {
        this.autoUpdatePlayerStoreTimeout = setTimeout(
          this.updatePlayerStore,
          this.autoUpdatePlayerStoreInterval
        )
      }
    }
  }

  async connect() {
    await super.connect()
    if (this.autoUpdatePlayerStore) {
      this.updatePlayerStore()
    }
  }

  async disconnect(): Promise<void> {
    clearTimeout(this.autoUpdatePlayerStoreTimeout)
    await this.disconnect()
  }
}
