import BasePlugin, { type EventSpec } from './base-plugin.js'

export default class FogOfWar extends BasePlugin<typeof FogOfWar> {
  static override description =
    'The <code>FogOfWar</code> plugin can be used to automate setting fog of war mode.'

  static override optionSpec = {
    mode: {
      description: 'Fog of war mode to set.',
      default: 1 as 0 | 1,
    },
    delay: {
      description: 'Delay before setting fog of war mode. (seconds)',
      default: 10,
    },
  }

  static override eventSpec = [
    {
      event: 'MATCH_START',
      source: 'LOG',
      handler: 'onNewGame',
    },
  ] satisfies EventSpec<typeof FogOfWar>[]

  async onNewGame() {
    setTimeout(() => {
      this.server.rcon.setFogOfWar(this.options.mode)
    }, this.options.delay * 1000)
  }
}
