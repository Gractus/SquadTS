/* eslint-disable @typescript-eslint/no-explicit-any */
import EventEmitter from 'events'

import type { Logger } from '@logtape/logtape'

import SquadServer, { type ServerEvents } from '../squad-server.js'
import type { RconEvents } from '../../rcon/squad-rcon-client.js'
import type { LogEvents } from '../../log-reader/log-parser/log-parser.js'

export interface PluginClass {
  new (server: SquadServer, config: PluginConfig): BasePlugin<any>
  description: string
  defaultEnabled: boolean
  dependencySpec: DependencySpec
  optionSpec: OptionSpec
  commandSpec: CommandSpec<any>
  eventSpec: EventSpec<any>[]
}

/** Used to specify all options the plugin will offer users of the plugin.  */
export type OptionSpec = {
  [name: string]: {
    /** Used in the auto-generated docs. */
    description: string
    /** If excluded or set to `undefined` this option is required and the user must specify. */
    default?: boolean | string | number | object | null
    /** Used in auto-generated docs and to derive the type if no default is provided. */
    example?: boolean | string | number | object | null
  }
}

export type CommandSpec<T extends InstanceType<PluginClass> = any> = {
  [name: string]: {
    /** Used in the auto-generated docs. */
    description: string
    /** Function called when the command is executed via one of the command aliases in the in-game chat. */
    handler: EventHandlers<T, ServerEvents['CHAT_COMMAND']>
    /** Default set of keywords that can be used to trigger the command ('!alias' in chat). Can be overridden in config.*/
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

type EventHandlers<T extends InstanceType<PluginClass>, Event> = Extract<
  { [K in keyof T]: T[K] extends (arg: Event) => void ? K : never }[keyof T],
  string
>

type EventSpecEntry<
  T extends InstanceType<PluginClass>,
  M extends Record<string, any>,
> = {
  [K in keyof M]: { event: K; handler: EventHandlers<T, M[K]> }
}[keyof M]

type EventSpecEntryWithSource<
  T extends InstanceType<PluginClass>,
  S,
  M extends Record<string, any>,
> = { source: S } & EventSpecEntry<T, M>

export type EventSpec<T extends InstanceType<PluginClass>> =
  | EventSpecEntry<T, ServerEvents> // Default when no source specified
  | EventSpecEntryWithSource<T, 'server', RconEvents>
  | EventSpecEntryWithSource<T, 'RCON', RconEvents>
  | EventSpecEntryWithSource<T, 'LOG', LogEvents>

export type OptionsFromSpec<T extends OptionSpec> = {
  [K in keyof T]: 'default' extends keyof T[K]
    ? T[K]['default']
    : 'example' extends keyof T[K]
      ? T[K]['example']
      : unknown
}
export type CommandAliasFromSpec<T extends CommandSpec> = {
  [K in keyof T]: string[]
}
export type ConnectionsFromSpec<T extends DependencySpec> = {
  [K in keyof T]: string
}

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

export default abstract class BasePlugin<TStatic extends PluginClass> {
  server: SquadServer
  // events = new EventEmitter()
  config!: PluginConfig<TStatic>
  log: Logger
  options!: OptionsFromSpec<TStatic['optionSpec']>
  deps!: ConnectionRecordFromSpec<TStatic['dependencySpec']>
  boundHandlerFunctions: Map<string, (...args: any[]) => void> = new Map()
  safeToUnmount: boolean = true
  constructor(server: SquadServer, config: PluginConfig<TStatic>) {
    this.server = server
    this.log = server.logger.getChild(this.constructor.name)
    this.config = config
    this.options = config.options
  }

  static get description(): string {
    return ''
  }

  static readonly defaultEnabled: boolean = false

  /**
   * Specify all user configurable options your plugin has.
   * These will all be available in this.options
   * If you don't specify a default, then a value must be specified in the user supplied config or the config will fail to parse.
   */
  static readonly optionSpec: OptionSpec = {}

  /**
   * Specify all plugin dependencies your plugin wants.
   * These will be automatically found and stored in this.deps when your plugin is mounted.
   * If you specify a plugin as optional you need to make your own checks to determine if that instance exists whenever you try to use it.
   */
  static readonly dependencySpec: DependencySpec = {}

  /**
   * Specify all chat commands you want to listen for and they will be automatically (un)bound on (un)mount.
   */
  static readonly commandSpec: CommandSpec<any> = {}

  /**
   * Specify all events you want to listen for and they will be automatically (un)bound on (un)mount.
   * Don't use this for chat commands, use the dedicated commandSpec instead.
   */
  static readonly eventSpec: EventSpec<any>[] = []

  /**
   * Perform any work that needs to be done before the plugin is considered ready to mount.
   * e.g. Bind event handler functions, connect to a database, authenticate with some API, etc.
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

  async mount() {
    await this.prepareToMount()

    // Find all dependencies and load them into this.deps
    const deps: Record<string, BasePlugin<any>> = {}
    for (const [dep, spec] of Object.entries(
      (this.constructor as TStatic).dependencySpec as DependencySpec
    )) {
      const configuredInstance = (
        this.config.connections as ConnectionsFromSpec<
          TStatic['dependencySpec']
        >
      )[dep]
      if (configuredInstance === undefined) {
        // Skip un-configured optional connection
        // Config is already validated before this point to make sure anything absent is indeed optional
        return
      }
      const pluginInstance = this.server.plugins.mountedPlugins.get(
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
    for (const event of (this.constructor as TStatic).eventSpec) {
      const emitter = this.getEmitterForSource(event)
      const fn = (this as unknown as Record<string, (args: any[]) => void>)[
        event.handler
      ]
      emitter.on(event.event, fn)
    }

    this.deps = deps as ConnectionRecordFromSpec<TStatic['dependencySpec']>

    // Bind all chat command event handlers
    for (const [command, spec] of Object.entries(
      (this.constructor as TStatic).commandSpec
    )) {
      const fn = (
        this as unknown as Record<
          string,
          (args: ServerEvents['CHAT_COMMAND']) => void
        >
      )[spec.handler]
      for (const alias of this.config.commandAliases[command]) {
        this.server.events.on(`CHAT_COMMAND:${alias}`, fn)
      }
    }
    await this.postMount()
  }

  async unmount() {
    if (!this.safeToUnmount)
      throw new Error('Plugin currently unsafe to unmount.')

    //Unbind all event listeners
    for (const event of (this.constructor as TStatic).eventSpec as EventSpec<
      InstanceType<TStatic>
    >[]) {
      const emitter = this.getEmitterForSource(event)
      const fn = (this as unknown as Record<string, (args: any[]) => void>)[
        event.handler
      ]
      emitter.removeListener(event.event, fn)
    }

    // Unbind all chat command event handlers
    for (const [command, spec] of Object.entries(
      (this.constructor as TStatic).commandSpec
    )) {
      const fn = (
        this as unknown as Record<
          string,
          (args: ServerEvents['CHAT_COMMAND']) => void
        >
      )[spec.handler]
      for (const alias of this.config.commandAliases[command]) {
        this.server.events.removeListener(`CHAT_COMMAND:${alias}`, fn)
      }
    }

    await this.unmountCleanup()
  }

  private getEmitterForSource(event: EventSpec<any>) {
    const source = 'source' in event ? event.source : undefined
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
      // default:
      //   emitter = (this.deps as Record<string, BasePlugin>)[source].events
    }
    return emitter
  }
}
