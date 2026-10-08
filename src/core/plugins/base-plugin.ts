/* eslint-disable @typescript-eslint/no-explicit-any */
import EventEmitter from 'events'

import type { Logger } from '@logtape/logtape'

import SquadServer, { type ServerEvents } from '../squad-server.js'
import type { RconEvents } from '../../rcon/squad-rcon-client.js'
import type { LogEvents } from '../../log-reader/log-parser/log-parser.js'

export interface PluginClass {
  new (server: SquadServer, config: PluginConfig): BasePlugin
  parseConfig(config: unknown): PluginConfig
  parseOptionsConfig(optionsConfig: unknown): OptionsFromSpec<any>
  parseConnectionsConfig(connectionsConfig: unknown): ConnectionsFromSpec<any>
  parseCommandConfig(commandAliasesConfig: unknown): CommandAliasFromSpec<any>
  description: string
  defaultEnabled: boolean
  defaultConfig: PluginConfig
  dependencySpec: DependencySpec
  optionSpec: OptionSpec
  commandSpec: CommandSpec<any>
}

export type OptionSpec = {
  [key: string]: {
    description: string
    default?: any
    example?: any
  }
}

export type CommandSpec<T extends BasePlugin> = {
  [key: string]: {
    description: string
    handler: ChatCommandHandler<T>
    aliases: string[]
  }
}

export type DependencySpec = {
  [key: string]: {
    plugin: PluginClass
    description?: string
    optional?: boolean
  }
}

type MethodNames<T> = {
  [K in keyof T]-?: T[K] extends (...args: any[]) => any ? K : never
}[keyof T]

type EventHandler<EventMap> = {
  [K in keyof EventMap]: (arg: EventMap[K]) => any
}[keyof EventMap]

export type EventHandlers<T extends InstanceType<PluginClass>, EventMap> = {
  [K in keyof T]-?: T[K] extends EventHandler<EventMap> ? K : never
}[keyof T]

type ChatCommandHandler<T> = {
  [K in keyof T]-?: T[K] extends (message: ServerEvents['CHAT_COMMAND']) => void
    ? K
    : never
}[keyof T]

export type EventSpec<T extends PluginClass> =
  | {
      source?: 'server'
      event: keyof ServerEvents
      handler: MethodNames<InstanceType<T>>
    }
  | {
      source: 'RCON'
      event: keyof RconEvents
      handler: EventHandlers<InstanceType<T>, RconEvents>
    }
  | {
      source: 'LOG'
      event: keyof LogEvents
      handler: EventHandlers<InstanceType<T>, LogEvents>
    }
  | {
      source: keyof T['dependencySpec']
      event: any
      handler: MethodNames<InstanceType<T>>
    }

type OptionsFromSpec<T extends OptionSpec> = {
  [K in keyof T]: 'default' extends keyof T[K]
    ? T[K]['default']
    : 'example' extends keyof T[K]
      ? T[K]['example']
      : any
}
type CommandAliasFromSpec<T extends CommandSpec<any>> = {
  [K in keyof T]: string[]
}
type ConnectionsFromSpec<T extends DependencySpec> = { [K in keyof T]: string }

type ConnectionRecordFromSpec<T extends DependencySpec> =
  // Step 1: Handle required keys (where optional is NOT true)
  {
    [K in keyof T as T[K]['optional'] extends true ? never : K]: InstanceType<
      T[K]['plugin']
    >
  } & {
    // Step 2: Handle optional keys (where optional IS true)
    [K in keyof T as T[K]['optional'] extends true ? K : never]?: InstanceType<
      T[K]['plugin']
    >
  } extends infer O
    ? { [K in keyof O]: O[K] }
    : never // Step 3: Clean up the output type tooltip

export interface PluginConfig<P extends PluginClass = any> {
  plugin: string
  instance: string
  enabled: boolean
  connections: ConnectionsFromSpec<P['dependencySpec']>
  commandAliases: CommandAliasFromSpec<P['commandSpec']>
  options: OptionsFromSpec<P['optionSpec']>
}

export default abstract class BasePlugin<TStatic extends PluginClass = any> {
  server: SquadServer
  log: Logger
  events: EventEmitter = new EventEmitter()
  config: PluginConfig<TStatic>
  options: OptionsFromSpec<TStatic['optionSpec']>
  deps!: ConnectionRecordFromSpec<TStatic['dependencySpec']>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  boundHandlerFunctions: Map<string, Function> = new Map()
  safeToUnmount: boolean = true
  constructor(server: SquadServer, config: PluginConfig<TStatic>) {
    const validConfig = BasePlugin.parseConfig(config)
    this.server = server
    this.log = server.logger.getChild(this.constructor.name)
    this.config = validConfig
    this.options = validConfig.options as OptionsFromSpec<TStatic['optionSpec']>
    this.mount()
  }

  static get description(): string {
    return ''
  }

  static readonly defaultEnabled: boolean = false

  /**
   * Specify all events you want to listen for and they will be automatically (un)bound on (un)mount.
   * Don't use this for chat commands, use the dedicated commandSpec instead.
   */
  static readonly eventSpec: EventSpec<any>[] = []

  /**
   * Specify all chat commands you want to listen for and they will be automatically (un)bound on (un)mount.
   */
  static readonly commandSpec: CommandSpec<any> = {}

  /**
   * Specify all plugin dependencies your plugin wants.
   * These will be automatically found and stored in this.deps when your plugin is mounted.
   * If you specify a plugin as optional you need to make your own checks to determine if that instance exists whenever you try to use it.
   */
  static readonly dependencySpec: DependencySpec = {}

  /**
   * Specify all user configurable options your plugin has.
   * These will all be available in this.options
   * If you don't specify a default, then a value must be sepcified in the user supplied config or the config will fail to parse.
   */
  static readonly optionSpec: OptionSpec = {}

  /**
   * Perform any work that needs to be done before the plugin is considered ready to mount.
   * e.g. Connect to a database, authenticate with some API, etc.
   */
  async prepareToMount() {}

  /**
   * Runs at the end of the mounting process.
   * Could be used to bind dependencies to class properties.
   * e.g. this.discordClient = this.deps['discordClient']
   */
  async postMount() {}

  /**
   * Perform any cleanup that needs to be done after the plugin is unmounted.
   * e.g. Close connection to a database, logout of some API, etc.
   */
  async unmountCleanup() {}

  /**
   * Returns a default config for this plugin.
   * Note that if there are any options that don't have a default in your optionsSpec then this will fail since there is no valid default config.
   */
  static get defaultConfig(): PluginConfig {
    return this.parseConfig({
      plugin: this.name,
      instance: 'default',
      enabled: this.defaultEnabled,
      options: {},
      commandAliases: {},
      connections: {},
    })
  }

  /**
   * Validates a supplied config and fills in any unspecified configuration options with their defaults.
   * Returns a valid PluginConfig for this plugin.
   */
  static parseConfig(config: unknown): PluginConfig {
    if (
      typeof config !== 'object' ||
      config === null ||
      Array.isArray(config)
    ) {
      throw new TypeError('Config must be a plain object.')
    }

    const {
      plugin,
      instance,
      enabled = true,
      options = {},
      commandAliases = {},
      connections = {},
    } = config as Record<any, any>

    if (plugin !== this.name) {
      throw new TypeError(
        `Expected "${this.name}" in 'plugin' field of config.`
      )
    }
    if (typeof instance !== 'string') {
      throw new TypeError('Instance field of config must be a string.')
    }
    if (typeof enabled !== 'boolean') {
      throw new TypeError('Enabled field must be a boolean.')
    }

    const pluginConfig: PluginConfig = {
      plugin,
      instance,
      enabled,
      options: this.parseOptionsConfig(options),
      commandAliases: this.parseCommandConfig(commandAliases),
      connections: this.parseConnectionsConfig(connections),
    }
    return pluginConfig
  }

  static parseOptionsConfig(optionsConfig: unknown): OptionsFromSpec<any> {
    if (
      typeof optionsConfig !== 'object' ||
      optionsConfig === null ||
      Array.isArray(optionsConfig)
    ) {
      throw new TypeError('Options must be a plain object.')
    }

    const validatedOptions: Record<string, any> = {}

    for (const [option, spec] of Object.entries(this.optionSpec)) {
      const value = (optionsConfig as Record<any, any>)[option]

      if (value === undefined) {
        if (spec.default !== undefined) {
          validatedOptions[option] = spec.default
        } else {
          throw new Error(`Missing required option: ${option}`)
        }
      } else if (typeof value !== 'string') {
        throw new TypeError(`Option "${option}" is not a string.`)
      } else {
        validatedOptions[option] = value
      }
    }
    return validatedOptions as CommandAliasFromSpec<any>
  }

  static parseCommandConfig(
    commandAliasesConfig: unknown
  ): CommandAliasFromSpec<any> {
    if (
      typeof commandAliasesConfig !== 'object' ||
      commandAliasesConfig === null ||
      Array.isArray(commandAliasesConfig)
    ) {
      throw new TypeError('commandAliasesConfig must be a plain object.')
    }

    const validatedCommandAliases: Record<string, string[]> = {}

    for (const [command, spec] of Object.entries(this.commandSpec)) {
      const aliases = (commandAliasesConfig as Record<any, any>)[command]

      if (aliases === undefined) {
        validatedCommandAliases[command] = spec.aliases
      } else if (
        Array.isArray(aliases) &&
        aliases.every(item => typeof item === 'string')
      ) {
        validatedCommandAliases[command] = aliases
      } else {
        throw new TypeError(
          `Error in commandAliases on '${command}'. Command aliases must be an array of strings.`
        )
      }
    }
    return validatedCommandAliases as CommandAliasFromSpec<any>
  }

  static parseConnectionsConfig(
    connectionConfig: unknown
  ): ConnectionsFromSpec<any> {
    if (
      typeof connectionConfig !== 'object' ||
      connectionConfig === null ||
      Array.isArray(connectionConfig)
    ) {
      throw new TypeError('dependencyConfig must be a plain object.')
    }
    const validatedConnections: Record<string, string> = {}

    for (const [dep, spec] of Object.entries(
      this.dependencySpec as DependencySpec
    )) {
      const value = (connectionConfig as Record<any, any>)[dep]

      if (value === undefined) {
        if (spec?.optional !== true) {
          throw new Error(
            `Required connection is not specified in config: ${dep}`
          )
        }
      } else if (typeof value === 'string') {
        validatedConnections[dep] = value
      } else {
        throw new TypeError(
          `Error in dependencyConfig on '${dep}'. Connection instance must be string.`
        )
      }
    }
    return validatedConnections as ConnectionsFromSpec<any>
  }

  bindEventHandler(emitter: EventEmitter, event: string, handler: string) {
    const handlerString = handler
    let fn = this.boundHandlerFunctions.get(handlerString)
    if (fn === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      fn = (this as any)[handlerString].bind(this) as Function
      this.boundHandlerFunctions.set(handlerString, fn)
    }
    emitter.on(event, fn())
  }

  unbindEventHandler(emitter: EventEmitter, event: string, handler: string) {
    const handlerString = handler
    const fn = this.boundHandlerFunctions.get(handlerString)
    if (fn === undefined)
      throw new Error("Can't unbind handler that was never registered.")
    emitter.removeListener(event, fn())
  }

  async mount() {
    await this.prepareToMount()

    // Find all dependencies and load them into this.deps
    const deps: Record<string, any> = {}
    for (const [dep, spec] of Object.entries(
      (this.constructor as typeof BasePlugin).dependencySpec
    )) {
      const configuredInstance = this.config.connections[dep]
      if (configuredInstance === undefined) {
        // Skip unconfigured optional connection
        // Config is already validated before this point to make sure anything absent is indeed optional
        return
      }
      const pluginInstance = this.server.plugins.loadedPlugins.get(
        spec.plugin
      )?.[configuredInstance]
      if (pluginInstance === undefined) {
        throw new Error(
          `Configured connection is not mounted: ${configuredInstance}`
        )
      } else {
        deps[dep] = pluginInstance
      }
    }

    // Bind all event listeners
    for (const event of (this.constructor as typeof BasePlugin).eventSpec) {
      let emitter: EventEmitter
      const source = event?.source
      switch (source) {
        case undefined:
        case 'server':
          emitter = this.server.events
          break
        case 'RCON':
          emitter = this.server.rcon.events
          break
        case 'LOG':
          emitter = this.server.logReader.events
          break
        default:
          emitter = deps[source as string]
          // Skip binding handler for missing optional dependency
          if (!emitter) {
            continue
          }
      }
      this.bindEventHandler(emitter, event.event, event.handler)
    }

    this.deps = deps as ConnectionRecordFromSpec<TStatic['dependencySpec']>

    // Bind all chat command event handlers
    for (const [command, spec] of Object.entries(
      (this.constructor as typeof BasePlugin).commandSpec
    )) {
      const aliases = this.config.commandAliases[command]
      for (const alias of aliases) {
        this.bindEventHandler(
          this.server.rcon.events,
          `CHAT_COMMAND:${alias}`,
          spec.handler
        )
      }
    }
  }

  async unmount() {
    if (!this.safeToUnmount)
      throw new Error('Plugin currently unsafe to unmount.')

    // Notify any dependent plugins that this plugin is being unmounted.
    this.events.removeAllListeners()

    //Unbind all event listeners
    ;(this.constructor as typeof BasePlugin).eventSpec.forEach(event => {
      const source = event?.source
      let emitter: EventEmitter
      switch (source) {
        case 'server':
        case undefined:
          emitter = this.server.events
          break
        case 'RCON':
          emitter = this.server.rcon.events
          break
        case 'LOG':
          emitter = this.server.logReader.events
          break
        default:
          emitter = (this.deps as Record<string, any>)[
            source as string
          ] as EventEmitter
          if (!emitter) {
            return
          }
      }
      this.unbindEventHandler(emitter, event.event, event.handler)
    })

    // Unbind all chat command event handlers
    for (const [command, spec] of Object.entries(
      (this.constructor as typeof BasePlugin).commandSpec
    )) {
      // Overload default aliases with those from config if any exist.
      const aliases = this.config.commandAliases[command]
      aliases.forEach(alias => {
        this.unbindEventHandler(
          this.server.rcon.events,
          `CHAT_COMMAND:${alias}`,
          spec.handler
        )
      })
    }

    await this.unmountCleanup()
  }
}
