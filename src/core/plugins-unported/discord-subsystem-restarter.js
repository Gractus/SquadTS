import BasePlugin from './base-plugin.js'

export default class DiscordSubsystemRestarter extends BasePlugin {
  static get description() {
    return (
      'The <code>DiscordSubSystemRestarter</code> plugin allows you to manually restart SquadJS subsystems in case ' +
      'an issues arises with them.' +
      '<ul>' +
      '<li><code>!squadjs restartsubsystem rcon</code></li>' +
      '<li><code>!squadjs restartsubsystem logparser</code></li>' +
      '</ul>'
    )
  }

  static get defaultEnabled() {
    return false
  }

  static get optionsSpecification() {
    return {
      discordClient: {
        required: true,
        description: 'Discord connector name.',
        connector: 'discord',
        default: 'discord',
      },
      role: {
        required: true,
        description:
          'ID of role required to run the sub system restart commands.',
        default: '',
        example: '667741905228136459',
      },
    }
  }

  constructor(server, options, connectors) {
    super(server, options, connectors)

    this.onMessage = this.onMessage.bind(this)
  }

  async mount() {
    this.options.discordClient.on('messageCreate', this.onMessage)
  }

  async unmount() {
<<<<<<< HEAD:src/core/plugins/discord-subsystem-restarter.js
    this.options.discordClient.removeListener('messageCreate', this.onMessage);
=======
    this.options.discordClient.removeEventListener(
      'messageCreate',
      this.onMessage
    )
>>>>>>> 72db7a7 (Mostly finished rewrite.):src/core/plugins-unported/discord-subsystem-restarter.js
  }

  async onMessage(message) {
    // check the author of the message is not a bot
    if (message.author.bot) return

    if (message.content.match(/!squadjs restartsubsystem rcon/i)) {
<<<<<<< HEAD:src/core/plugins/discord-subsystem-restarter.js
      if (!message.member.roles.cache.has(this.options.role)) {
        message.reply('you do not have permission to do that.');
        return;
=======
      if (!message.member._roles.includes(this.options.role)) {
        message.reply('you do not have permission to do that.')
        return
>>>>>>> 72db7a7 (Mostly finished rewrite.):src/core/plugins-unported/discord-subsystem-restarter.js
      }

      await this.server.restartRCON()
      message.reply('restarted the SquadJS RCON subsystem.')
    }

    if (message.content.match(/!squadjs restartsubsystem logparser/i)) {
<<<<<<< HEAD:src/core/plugins/discord-subsystem-restarter.js
      if (!message.member.roles.cache.has(this.options.role)) {
        message.reply('you do not have permission to do that.');
        return;
=======
      if (!message.member._roles.includes(this.options.role)) {
        message.reply('you do not have permission to do that.')
        return
>>>>>>> 72db7a7 (Mostly finished rewrite.):src/core/plugins-unported/discord-subsystem-restarter.js
      }

      await this.server.restartLogParser()
      message.reply('restarted the SquadJS LogParser subsystem.')
    }
  }
}
