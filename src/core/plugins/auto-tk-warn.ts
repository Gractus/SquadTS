import type { ServerEvents } from '../squad-server.js'
import BasePlugin, { type EventSpec, type OptionSpec } from './base-plugin.js'

export default class AutoTKWarn extends BasePlugin<typeof AutoTKWarn> {
  static override description =
    'The <code>AutoTkWarn</code> plugin will automatically warn players with a message when they teamkill.'
  static override defaultEnabled = true

  static override readonly optionSpec = {
    attackerMessage: {
      description: 'The message to warn attacking players with.',
      default: 'Please apologise for ALL TKs in ALL chat!',
    },
    victimMessage: {
      description: 'The message that will be sent to the victim.',
      default: null as null | string,
      example: 'You were killed by your own team.',
    },
  } satisfies OptionSpec

  static override readonly eventSpec = [
    {
      event: 'TEAM_KILL',
      handler: 'onTeamKill',
    },
  ] satisfies EventSpec<typeof AutoTKWarn>[]

  async onTeamKill(event: ServerEvents['TEAM_KILL']) {
    if (this.options.attackerMessage) {
      this.server.rcon.warn(event.attacker.eosID, this.options.attackerMessage)
    }
    if (this.options.victimMessage) {
      this.server.rcon.warn(event.victim.eosID, this.options.victimMessage)
    }
  }
}
