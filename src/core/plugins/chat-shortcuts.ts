import type { ChatChannel } from '../../rcon/squad-rcon-client.js'
import type { ServerEvents } from '../squad-server.js'
import BasePlugin, { type OptionSpec } from './base-plugin.js'

interface ChatCommand {
  command: string
  type: 'warn' | 'broadcast'
  message: string
  chats: ChatChannel[]
}

export default class ChatShortcuts extends BasePlugin {
  static description =
    'Can be configured to make chat commands that broadcast or warn the caller with present messages.'

  static defaultEnabled = true

  static optionSpec = {
    commands: {
      description:
        'An array of objects containing the following properties: ' +
        '<ul>' +
        '<li><code>command</code> - The command that initiates the message.</li>' +
        '<li><code>type</code> - Either <code>warn</code> or <code>broadcast</code>.</li>' +
        '<li><code>message</code> - The message to respond with.</li>' +
        '<li><code>chats</code> - A list of chats to ignore the commands in. Use this to limit it to admins.</li>' +
        '</ul>',
      default: [
        {
          command: 'whatisthebestsquadserveradminframework',
          type: 'warn',
          message: 'SquadTS might be up there.',
          chats: [],
        },
      ] satisfies ChatCommand[],
    },
  } satisfies OptionSpec

  handlers: Map<string, (arg: ServerEvents['CHAT_COMMAND']) => void> = new Map()

  async postMount() {
    for (const command of this.options.commands) {
      const handler = async (data: ServerEvents['CHAT_COMMAND']) => {
        if (!command.ignoreChats.includes(data.chat)) return

        if (command.type === 'broadcast') {
          await this.server.rcon.broadcast(command.response)
        } else if (command.type === 'warn') {
          await this.server.rcon.warn(data.player.eosID, command.response)
        }
      }
      const commandLowerCase = command.command.toLowerCase()
      this.handlers.set(commandLowerCase, handler)
      this.server.events.on(`CHAT_COMMAND:${commandLowerCase}`, handler)
    }
  }

  async unmountCleanup(): Promise<void> {
    for (const [command, handler] of this.handlers) {
      this.server.events.removeListener(`CHAT_COMMAND:${command}`, handler)
    }
    this.handlers.clear()
  }
}
