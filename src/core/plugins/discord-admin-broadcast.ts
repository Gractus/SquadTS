import type { LogEvents } from '../../log-reader/log-parser/log-parser.js'
import BasePlugin, {
  type DependencySpec,
  type EventSpec,
  type OptionSpec,
} from './base-plugin.js'
import DiscordClient from './discord-connection.js'

export default class DiscordAdminBroadcast extends BasePlugin<
  typeof DiscordAdminBroadcast
> {
  static override readonly description =
    'The <code>DiscordAdminBroadcast</code> plugin will send a copy of admin broadcasts made in game to a Discord channel.'

  static override readonly optionSpec = {
    channelID: {
      description: 'The ID of the channel to log admin broadcasts to.',
      default: null as string | null,
      example: '112233445566778899',
    },
    color: {
      description: 'The color of the embed.',
      default: 16761867,
    },
  } satisfies OptionSpec

  static override readonly dependencySpec = {
    discordClient: {
      plugin: DiscordClient,
      description: 'Instance to use for messages.',
    },
  } satisfies DependencySpec

  static override readonly eventSpec = [
    {
      source: 'LOG',
      event: 'ADMIN_BROADCAST',
      handler: 'onAdminBroadcast',
    },
  ] satisfies EventSpec<typeof DiscordAdminBroadcast>[]

  discordClient!: DiscordClient

  override async postMount() {
    this.discordClient = this.deps['discordClient']
  }

  async onAdminBroadcast(data: LogEvents['ADMIN_BROADCAST']) {
    await this.discordClient.sendEmbed({
      title: 'Admin Broadcast',
      color: this.options.color,
      fields: [
        {
          name: 'Message',
          value: `${data.message}`,
        },
      ],
      timestamp: data.time.toISOString(),
    })
  }
}
