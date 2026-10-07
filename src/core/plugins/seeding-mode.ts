import BasePlugin, { type EventSpec, type OptionSpec } from './base-plugin.js'

export default class SeedingMode extends BasePlugin<typeof SeedingMode> {
  static override description =
    'The <code>SeedingMode</code> plugin broadcasts seeding rule messages to players at regular intervals ' +
    'when the server is below a specified player count. It can also be configured to display "Live" messages when ' +
    'the server goes live.'

  static override defaultEnabled = true

  static override optionSpec = {
    interval: {
      description: 'Frequency of seeding messages in seconds.',
      default: 2.5 * 60,
    },
    seedingThreshold: {
      description:
        'Player count required for server not to be in seeding mode.',
      default: 50,
    },
    seedingMessage: {
      description: 'Seeding message to display.',
      default:
        'Seeding Rules Active! Fight only over the middle flags! No FOB Hunting!',
    },
    liveEnabled: {
      description: 'Enable "Live" messages for when the server goes live.',
      default: true,
    },
    liveThreshold: {
      description:
        'Player count required for "Live" messages to not be displayed.',
      default: 52,
    },
    liveMessage: {
      description: 'Message to display when match is no longer seeding.',
      default: 'Live!',
    },
    waitOnNewGames: {
      description: 'Should the plugin wait to be executed on NEW_GAME event.',
      default: true,
    },
    waitTimeOnNewGame: {
      description: 'The time to wait before check player counts in seconds.',
      default: 30,
    },
  } satisfies OptionSpec

  static eventSpec = [
    {
      event: 'MATCH_START',
      source: 'LOG',
      handler: 'onNewGame',
    },
  ] satisfies EventSpec<typeof SeedingMode>[]

  silenced = false
  interval?: NodeJS.Timeout

  async postMount() {
    this.interval = setInterval(async () => {
      if (this.silenced) return
      if (
        this.server.playerCount !== 0 &&
        this.server.playerCount < this.options.seedingThreshold
      ) {
        await this.server.rcon.broadcast(this.options.seedingMessage)
      } else if (
        this.server.playerCount !== 0 &&
        this.options.liveEnabled &&
        this.server.playerCount < this.options.liveThreshold
      )
        await this.server.rcon.broadcast(this.options.liveMessage)
    }, this.options.interval * 1000)
  }

  async unmountCleanup() {
    clearInterval(this.interval)
  }

  onNewGame() {
    if (this.options.waitOnNewGames) this.silenced = true
    setTimeout(() => {
      this.silenced = false
    }, this.options.waitTimeOnNewGame * 1000)
  }
}
