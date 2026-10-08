import EventEmitter from 'events'

import type { AccessOptions } from 'basic-ftp'
import type { ConnectConfig } from 'ssh2'

import { getLogger, type Logger } from '@logtape/logtape'

import {
  type ExternalIDs,
  type MatchOutcome,
  TeamID,
  type ToEventEmitterMap,
} from '../common/types.js'
import type { Layer } from '../game-info/layers.js'
import { LogReader } from '../log-reader/log-reader-base.js'
import { FTPLogReader } from '../log-reader/log-reader-ftp.js'
import { LocalLogReader } from '../log-reader/log-reader-local.js'
import { SFTPLogReader } from '../log-reader/log-reader-sftp.js'
import { type Player, PlayerStore } from '../rcon/player-store.js'
import SquadRconClient, {
  ChatChannel,
  type RconClientOptions,
  type ServerBrowserInfo,
} from '../rcon/squad-rcon-client.js'
import {
  type AdminList,
  type AdminsRegister,
  readAdminLists,
} from './admins.js'
import { PluginManager } from './plugin-manager.js'
import type { PluginConfig } from './plugins/base-plugin.js'

export interface ServerConfig {
  id: string | number
  host: string
  queryPort: number
  rcon: RconClientOptions
  logReader: LogReaderOptions
  plugins?: PluginConfig[]
  adminLists?: AdminList[]
  layerHistoryMaxLength?: number
  updateServerInfoInterval?: number
}

export interface LogReaderOptions {
  logFile: string
  mode: 'FTP' | 'SFTP' | 'local'
  ftp?: AccessOptions
  sftp?: ConnectConfig
}

export interface ServerEvents {
  CHAT_COMMAND: {
    time: Date
    chat: ChatChannel
    arg: string
    player: ExternalIDs
  }
  TEAM_KILL: {
    time: Date
    teamID: TeamID
    attacker: Player
    victim: Player
  }
}

export default class SquadServer {
  options: ServerConfig
  id: string | number

  logger: Logger
  events = new EventEmitter<ToEventEmitterMap<ServerEvents>>()
  rcon: SquadRconClient
  logReader: LogReader
  plugins: PluginManager

  playerStore: PlayerStore
  admins: AdminsRegister = new Map()
  currentLayer?: Layer
  matchHistory: MatchOutcome[]
  serverBrowserInfo: ServerBrowserInfo | undefined

  updateServerInfoTimeout: NodeJS.Timeout | undefined

  constructor(config: ServerConfig) {
    this.logger = getLogger(`Server ${config.id}`)
    this.plugins = new PluginManager(this)
    this.options = structuredClone(config)
    this.id = config.id

    this.rcon = new SquadRconClient(
      {
        autoUpdatePlayerStore: true,
        autoReconnect: true,
        ...config.rcon,
      },
      this.logger
    )

    switch (config.logReader.mode) {
      case 'local': {
        this.logReader = new LocalLogReader(
          config.logReader.logFile,
          this.logger
        )
        break
      }
      case 'FTP': {
        this.logReader = new FTPLogReader(
          config.logReader.logFile,
          config.logReader.ftp!,
          this.logger
        )
        break
      }
      case 'SFTP': {
        this.logReader = new SFTPLogReader(
          config.logReader.logFile,
          config.logReader.sftp!,
          this.logger
        )
        break
      }
      default:
        throw new Error('Invalid Log Reader Mode.')
    }

    this.matchHistory = []
    this.playerStore = this.rcon.playerStore

    this.options.layerHistoryMaxLength = config.layerHistoryMaxLength || 20
    this.options.updateServerInfoInterval =
      config.updateServerInfoInterval ?? 30 * 1000

    this.updateServerInfo = this.updateServerInfo.bind(this)
  }

  async watch() {
    this.logger.info(
      `Beginning to watch ${this.options.rcon.host}:${this.options.rcon.port}...`
    )

    await this.refreshAdminLists()

    await this.rcon.connect()
    this.watchRCON()
    this.currentLayer = await this.rcon.getCurrentMap()
    await this.updateServerInfo()

    await this.logReader.connect()
    this.watchLog()

    if (this.options.plugins) {
      this.plugins.loadConfig(this.options.plugins)
    }

    this.logger.info(`Watching ${this.serverBrowserInfo!.serverName}...`)
  }

  async unwatch() {
    this.rcon.events.removeAllListeners()
    await this.rcon.disconnect()
    this.logReader.events.removeAllListeners()
    this.logReader.disconnect()
  }

  private watchRCON() {
    this.rcon.events.on('CHAT_MESSAGE', async data => {
      const command = data.message.match(/^\s*!(?<command>[^\s]+) ?(?<arg>.*)/)
      if (command?.groups)
        this.events.emit(
          `CHAT_COMMAND:${command.groups.command.toLowerCase()}`,
          {
            time: data.time,
            chat: data.channel,
            arg: command.groups.args.trim(),
            player: data.player,
          }
        )
    })

    this.rcon.events.on('PLAYER_CONNECTED', () => {
      this.events.emit('PLAYER_COUNT_CHANGED')
    })
    this.rcon.events.on('PLAYER_DISCONNECTED', () => {
      this.events.emit('PLAYER_COUNT_CHANGED')
    })
  }

  private watchLog() {
    this.logReader.events.on('MATCH_START', data => {
      this.currentLayer = data.layer
      this.refreshAdminLists()
    })

    this.logReader.events.on('MATCH_ENDED', data => {
      this.matchHistory.unshift(data)
      this.matchHistory = this.matchHistory.slice(
        0,
        this.options.layerHistoryMaxLength
      )
    })

    this.logReader.events.on('PLAYER_WOUNDED', data => {
      if (data.attackerEOSID) {
        const attacker = this.playerStore.getPlayerByEOSID(data.attackerEOSID)
        const possibleVictims = Array.from(
          this.playerStore.getPlayersByName(data.victimName)
        )
        if (possibleVictims.length === 1) {
          const victim = possibleVictims[0]
          if (attacker?.teamID === victim.teamID) {
            this.events.emit('TEAM_KILL', {
              time: data.time,
              teamID: attacker.teamID,
              attacker: attacker,
              victim: victim,
            })
          }
        }
      }
    })
  }

  async updateServerInfo() {
    clearTimeout(this.updateServerInfoTimeout)

    this.logger.info(`Updating server information...`)

    const response = await this.rcon.getServerBrowserInfo()
    if (response instanceof Error)
      this.logger.error(`ServerInfo update failed with error: ${response}`)
    else {
      this.serverBrowserInfo = response
      this.events.emit('UPDATED_SERVER_INFO', this.serverBrowserInfo)
      this.logger.info(`Updated server information.`)
    }

    this.updateServerInfoTimeout = setTimeout(
      this.updateServerInfo,
      this.options.updateServerInfoInterval
    )
  }

  // async updateLayerInfo() {
  //   clearTimeout(this.updateLayerInfoTimeout);

  //   this.logger.info(`Updating layer information...`);

  //   try {
  //     this.currentMap = await this.rcon.getCurrentMap();
  //     this.nextMap = this.rcon.getNextMap();
  //     this.emit('UPDATED_LAYER_INFORMATION');
  //   } catch (err) {
  //     this.logger.error('Failed to update layer information.', err);
  //   }

  //   this.logger.info(`Updated layer information.`);

  //   this.updateLayerInfoTimeout = setTimeout(
  //     this.updateLayerInfo,
  //     this.options.updateLayerInfoInterval
  //   );
  // }

  async refreshAdminLists() {
    if (this.options.adminLists) {
      try {
        this.admins = await readAdminLists(this.options?.adminLists)
      } catch (err) {
        this.logger.error(`Error updating admin register: ${err}`)
      }
    }
  }

  /** Send in game notification to all admins in server. */
  async notifyAdmins(message: string) {
    try {
      for (const player of this.activeAdmins) {
        await this.rcon.warn(player.eosID, message)
      }
    } catch (error) {
      this.logger.error(`Failed to notify admins: ${error}`)
    }
  }

  get activeAdmins(): Player[] {
    const activeAdmins: Player[] = []
    for (const player of this.playerStore.players) {
      if (
        player.steamID &&
        this.admins.get(player.steamID)?.['canseeadminchat']
      ) {
        activeAdmins.push(player)
      }
    }
    return activeAdmins
  }

  get playerCount() {
    return this.playerStore.playerCount
  }
  get players() {
    return this.playerStore.players
  }
  get team1() {
    return this.playerStore.team1
  }
  get team2() {
    return this.playerStore.team2
  }
}
