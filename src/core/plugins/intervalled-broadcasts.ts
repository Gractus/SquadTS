import BasePlugin from './base-plugin.js'

export default class IntervalBroadcasts extends BasePlugin<
  typeof IntervalBroadcasts
> {
  static description =
    'The <code>IntervalledBroadcasts</code> plugin allows you to set broadcasts, which will be broadcasted at ' +
    'preset intervals'
  static defaultEnabled = false

  static optionSpec = {
    broadcasts: {
      required: false,
      description: 'Messages to broadcast.',
      example: ['This server is powered by SquadJS.'],
    },
    interval: {
      required: false,
      description: 'Frequency of the broadcasts in seconds.',
      default: 5 * 60,
    },
  }

  interval?: NodeJS.Timeout
  index = 0

  async prepareToMount() {
    if (this.options.broadcasts.length === 0)
      throw new Error(
        'You must specify at least one message, otherwise disable this plugin.'
      )
  }

  async postMount() {
    this.interval = setInterval(async () => {
      try {
        if (this.index >= this.options.broadcasts.length) {
          this.index = 0
        }
        await this.server.rcon.broadcast(this.options.broadcasts[this.index])
        this.index++
      } catch {
        /** Pass */
      }
    }, this.options.interval * 1000)
  }

  async unmountCleanup() {
    clearInterval(this.interval)
  }
}
