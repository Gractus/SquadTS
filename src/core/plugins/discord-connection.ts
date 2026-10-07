import {
  Client,
  Events,
  GatewayIntentBits,
  TextChannel,
  EmbedBuilder,
  type APIEmbed,
} from 'discord.js'

import BasePlugin, { type OptionSpec } from './base-plugin.js'
import { COPYRIGHT_MESSAGE } from '../../common/constants.js'

export default class DiscordClient extends BasePlugin<typeof DiscordClient> {
  static override description =
    'Maintains a connection to a discord bot.\nOther plugins should depend on this to share a single connection.'

  static readonly optionSpec = {
    APIkey: {
      description: 'Discord API key for your bot.',
      example: '123456789123456789',
    },
    DefaultChannelID: {
      description:
        'Unless otherwise specified all messages will go to this channel.',
      default: null as null | string,
      example: '123456789123456789',
    },
  } satisfies OptionSpec

  public client: Client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
  })
  defaultChannel: TextChannel | null = null

  async prepareToMount() {
    this.client.once(Events.ClientReady, readyClient => {
      console.log(`Ready! Logged in as ${readyClient.user.tag}`)
    })
    await this.client.login(this.config.options.APIkey)

    if (this.config.options.DefaultChannelID) {
      try {
        this.defaultChannel = (await this.client.channels.fetch(
          this.config.options.DefaultChannelID
        )) as TextChannel
      } catch (error) {
        throw new Error(
          `Failed to fetch default channel: Channel ID ${this.config.options.DefaultChannelID}`,
          { cause: error }
        )
      }
    }
  }

  async sendMessage<T extends { embeds: APIEmbed[] }>(message: string | T) {
    if (!this.defaultChannel) {
      this.log.info(
        `Could not send Discord Message. Default channel not initialized.`
      )
      return
    }

    await this.defaultChannel.send(message)
  }

  async sendEmbed(embed: APIEmbed) {
    const output = new EmbedBuilder(embed).setFooter(
      embed.footer ?? { text: COPYRIGHT_MESSAGE }
    ).data
    await this.sendMessage({ embeds: [output] })
  }
}
