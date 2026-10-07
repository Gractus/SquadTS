import type { eosID } from '../../common/online-ids.js'
import type { Player } from '../../rcon/player-store.js'
import type { RconEvents } from '../../rcon/squad-rcon-client.js'
import BasePlugin, { type EventSpec, type OptionSpec } from './base-plugin.js'

const ADMIN_PERMISSION = 'canseeadminchat'
const WHITELIST_PERMISSION = 'reserve'

interface Tracker {
  player: Player
  startTime?: Date
  warnIntervalID?: NodeJS.Timeout
  kickTimerID?: NodeJS.Timeout
}

export default class AutoKickUnassigned extends BasePlugin<
  typeof AutoKickUnassigned
> {
  static description =
    'The <code>AutoKickUnassigned</code> plugin will automatically kick players that are not in a squad after a specified amount of time.'
  static defaultEnabled = true

  static override optionSpec = {
    playerThreshold: {
      description:
        'Player count required for AutoKick to start kicking players, set to -1 to disable',
      default: 93,
    },
    timeBeforeKick: {
      description:
        'How long in <b>Seconds</b> to wait before a unassigned player is kicked',
      default: 360,
    },
    warnInterval: {
      description:
        'How often in <b>Seconds</b> should we warn the player about being unassigned?',
      default: 30,
    },
    warningMessage: {
      description: 'Warning message sent to unassigned players.',
      default: 'Join a squad, you are unassigned and will be kicked',
    },
    kickMessage: {
      description: 'Message set to players when they are kicked',
      default: 'Autokick - All players must join a squad.',
    },
    roundStartDelay: {
      description:
        'Time delay in <b>Seconds</b> from start of the round before AutoKick starts kicking again',
      default: 900,
    },
    ignoreAdmins: {
      description:
        '<ul>' +
        '<li><code>true</code>: Admins will <b>NOT</b> be kicked</li>' +
        '<li><code>false</code>: Admins <b>WILL</b> be kicked</li>' +
        '</ul>',
      default: false,
    },
    ignoreWhitelist: {
      description:
        '<ul>' +
        '<li><code>true</code>: Reserve slot players will <b>NOT</b> be kicked</li>' +
        '<li><code>false</code>: Reserve slot players <b>WILL</b> be kicked</li>' +
        '</ul>',
      default: false,
    },
  } satisfies OptionSpec

  static override eventSpec = [
    {
      event: 'MATCH_START',
      source: 'LOG',
      handler: 'onNewGame',
    },
    {
      event: 'PLAYER_SQUAD_CHANGE',
      source: 'RCON',
      handler: 'onPlayerSquadChange',
    },
    {
      event: 'PLAYER_CONNECTED',
      source: 'RCON',
      handler: 'onPlayerCountChanged',
    },
    {
      event: 'PLAYER_DISCONNECTED',
      source: 'RCON',
      handler: 'onPlayerDisconnect',
    },
  ] satisfies EventSpec<typeof AutoKickUnassigned>[]

  waitingAfterGameStart = false
  trackedPlayers: Map<eosID, Tracker> = new Map()
  newGameTimeout?: NodeJS.Timeout

  override async postMount() {
    for (const player of this.server.team1.unassigned) {
      this.track(player)
    }
    for (const player of this.server.team1.unassigned) {
      this.track(player)
    }
    this.onPlayerCountChanged()
  }

  override async unmountCleanup() {
    for (const tracker of this.trackedPlayers.values()) {
      this.stopTimer(tracker)
    }
    clearTimeout(this.newGameTimeout)
  }

  async onNewGame() {
    this.waitingAfterGameStart = true
    this.newGameTimeout = setTimeout(() => {
      this.waitingAfterGameStart = false
      this.onPlayerCountChanged()
    }, this.options.roundStartDelay * 1000)
  }

  onPlayerDisconnect(event: RconEvents['PLAYER_DISCONNECTED']) {
    this.unTrack(event.player.eosID)
    this.onPlayerCountChanged()
  }

  async onPlayerSquadChange(event: RconEvents['PLAYER_CHANGED_SQUAD']) {
    if (event.newSquadID) this.unTrack(event.player.eosID)
    else this.track(event.player)
  }

  onPlayerCountChanged() {
    if (this.waitingAfterGameStart) return

    let playersOverLimit =
      this.server.playerCount - this.options.playerThreshold
    for (const tracker of this.trackedPlayers.values()) {
      if (playersOverLimit > 0) {
        const steamID = tracker.player.steamID
        if (steamID) {
          const permissions = this.server.admins.get(steamID)
          if (
            permissions &&
            ((this.options.ignoreAdmins && permissions[ADMIN_PERMISSION]) ||
              (this.options.ignoreWhitelist &&
                permissions[WHITELIST_PERMISSION]))
          ) {
            continue
          }
        }
        this.startTimer(tracker)
        playersOverLimit--
      } else {
        this.stopTimer(tracker)
      }
    }
  }

  track(player: Player) {
    this.trackedPlayers.set(player.eosID, { player })
  }

  unTrack(eosID: eosID) {
    const tracker = this.trackedPlayers.get(eosID)
    if (tracker) {
      this.stopTimer(tracker)
      this.trackedPlayers.delete(eosID)
    }
  }

  startTimer(tracker: Tracker) {
    if (!tracker.startTime) {
      tracker.startTime = new Date()
      tracker.warnIntervalID = setInterval(() => {
        const timeLeft =
          Date.now() -
          tracker.startTime!.getTime() +
          this.options.timeBeforeKick * 1000
        this.server.rcon.warn(
          tracker.player.eosID,
          `${this.options.warningMessage} - ${this.msFormat(timeLeft)}`
        )
      }, this.options.warnInterval * 1000)
      tracker.kickTimerID = setTimeout(() => {
        this.server.rcon.kick(tracker.player.eosID, this.options.kickMessage)
      }, this.options.timeBeforeKick * 1000)
    }
  }

  stopTimer(tracker: Tracker) {
    clearTimeout(tracker.kickTimerID)
    clearInterval(tracker.warnIntervalID)
  }

  msFormat(ms: number) {
    // take in generic # of ms and return formatted MM:SS
    const min = Math.floor((ms / 1000 / 60) << 0)
    const sec = Math.floor((ms / 1000) % 60)
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
}
