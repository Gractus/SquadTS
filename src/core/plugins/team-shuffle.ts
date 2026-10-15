import type { ServerEvents } from '../squad-server.js'
import BasePlugin, { type CommandSpec } from './base-plugin.js'

export default class TeamShuffle extends BasePlugin {
  static description =
    'Extremely simple team shuffler. Absolutely smashes stacks. No mercy. No friends will be made today.'

  static defaultEnabled = true

  static commandSpec = {
    run: {
      description: 'Immediately shuffles the teams.',
      handler: 'shuffle',
      aliases: ['shuffle', 'teamsmasher', 'randomize'],
    },
  } satisfies CommandSpec<TeamShuffle>

  shuffle = async (info: ServerEvents['CHAT_COMMAND']) => {
    if (info.chat !== 'ADMIN') return

    const team1 = this.server.team1.players.toArray()
    const team2 = this.server.team2.players.toArray()

    for (let i = 0; i <= Math.max(team1.length, team2.length); i += 2) {
      if (i < team1.length) this.server.rcon.switchTeam(team1[i].eosID)
      if (i < team2.length) this.server.rcon.switchTeam(team2[i].eosID)
    }
  }
}
