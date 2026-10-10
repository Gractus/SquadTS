import fs from 'fs'

import type { Logger } from '@logtape/logtape'

import type {
  CommandAliasFromSpec,
  CommandSpec,
  ConnectionsFromSpec,
  DependencySpec,
  OptionsFromSpec,
  OptionSpec,
  PluginClass,
  PluginConfig,
} from './plugins/base-plugin.js'
import SquadServer from './squad-server.js'

const PLUGIN_DIR = new URL('plugins/', import.meta.url)

export async function loadPlugins(logger?: Logger): Promise<PluginClass[]> {
  const pluginRegistry: PluginClass[] = []

  const dir = await fs.promises.opendir(PLUGIN_DIR)
  for await (const dirent of dir) {
    // Exclude non javascript files
    if (!dirent.isFile() || !dirent.name.endsWith('.js')) continue

    // Exclude special files
    if (['base-plugin.js', 'readme.md'].includes(dirent.name)) continue

    logger?.info(`Loading plugin file ${dirent.name}...`)
    const { default: Plugin } = await import(PLUGIN_DIR + dirent.name)
    pluginRegistry.push(Plugin)
  }
  return pluginRegistry
}

export class PluginManager {
  server: SquadServer
  log: Logger
  pluginRegistry: PluginClass[] = []
  configRegistry: Map<PluginClass, Record<string, PluginConfig>> = new Map()
  mountedPlugins: Map<PluginClass, Record<string, InstanceType<PluginClass>>> =
    new Map()
  constructor(server: SquadServer) {
    this.server = server
    this.log = this.server.logger.getChild('Plugin Manager')
  }

  async mountFromConfig(config: PluginConfig[]) {
    this.pluginRegistry = await loadPlugins()
    for (const rawPluginConfig of config) {
      if (
        typeof rawPluginConfig !== 'object' ||
        rawPluginConfig === null ||
        Array.isArray(rawPluginConfig)
      ) {
        throw new TypeError('Config must be a plain object.')
      }

      const { plugin: pluginName, instance, enabled = true } = rawPluginConfig

      if (enabled !== true) {
        this.log.warn`Ignored disabled config for plugin: ${pluginName}`
        continue
      }

      const pluginClass = this.pluginRegistry.find(
        pluginClass => pluginClass.name === pluginName
      )
      if (!pluginClass)
        throw new Error(
          `Error parsing config: Plugin ${pluginName} does not exist.`
        )

      const validConfig = parseConfig(pluginClass, rawPluginConfig)

      const pluginInstances = this.configRegistry.get(pluginClass) ?? {}

      if (instance in pluginInstances)
        throw new Error(
          `Duplicate instance ID: ${instance} for plugin: ${pluginName}.`
        )

      pluginInstances[instance] = validConfig
      this.configRegistry.set(pluginClass, pluginInstances)
    }

    // Fill in default config for plugins that are enabled by default.
    for (const Plugin of this.pluginRegistry) {
      if (Plugin.defaultEnabled) {
        const defaultConfig = parseConfig(Plugin)
        const pluginInstances = this.configRegistry.get(Plugin) ?? {}
        if (defaultConfig.instance in pluginInstances) {
          // Skip inserting the default config if there is already a custom config loaded.
          continue
        }
        pluginInstances[defaultConfig.instance] = defaultConfig
        this.configRegistry.set(Plugin, pluginInstances)
      }
    }
  }

  async mountPlugins() {
    for (const [Plugin, configInstances] of this.configRegistry) {
      interface StackEntry {
        plugin: PluginClass
        config: PluginConfig
      }

      const stack: StackEntry[] = []
      for (const [instance, pluginConfig] of Object.entries(configInstances)) {
        // Check if already mounted
        const loadedInstance = this.mountedPlugins.get(Plugin)?.[instance]
        if (loadedInstance !== undefined) {
          continue
        }
        // DFS mounting of connectors
        stack.push({ plugin: Plugin, config: pluginConfig })
        while (stack.length !== 0) {
          for (const [connection, instance] of Object.entries(
            pluginConfig.connections
          )) {
            const pluginType = Plugin.dependencySpec[connection].plugin
            const loadedInstance =
              this.mountedPlugins?.get(pluginType)?.[instance]
            if (loadedInstance !== undefined) {
              continue
            }
            if (
              stack.some(
                item =>
                  item.plugin === pluginType &&
                  item.config.instance === instance
              )
            ) {
              throw new Error(
                `Circular dependency ${stack.map(entry => `'${entry.plugin}:${entry.config.instance}'`).join('->')}->'${pluginType}:${instance}'`
              )
            }
            const config = this.configRegistry?.get(pluginType)?.[instance]
            if (config === undefined)
              throw new Error(
                `Plugin: '${Plugin}:${pluginConfig.instance}' specifies dependency on '${pluginType}:${instance}', but there is no configured/enabled instance by that name.`
              )
            stack.push({ plugin: pluginType, config: config })
            break
          }
          const stackEntry = stack.pop()
          if (stackEntry) {
            const newPlugin = new stackEntry.plugin(
              this.server,
              stackEntry.config
            )
            await newPlugin.mount()
            const loadedInstances = this.mountedPlugins.get(Plugin) ?? {}
            loadedInstances[instance] = newPlugin
            this.mountedPlugins.set(Plugin, loadedInstances)
          }
        }
      }
    }
  }

  async unmountPlugins() {
    // TODO: This.
    return
  }
}

/**
 * Validates a supplied config and fills in any unspecified configuration options with their defaults.
 * Assuming there are no required values you can pass in an empty object to get the default config.
 * Throws an error if config has invalid types or is missing required values.
 */

export function parseConfig<P extends PluginClass>(
  pluginClass: P,
  config?: unknown
): PluginConfig<P> {
  if (config === undefined) {
    config = {}
  } else if (typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('Config must be a plain object.')
  }
  const {
    plugin = pluginClass.name,
    instance = 'default',
    enabled = pluginClass.defaultEnabled,
    options,
    commandAliases,
    connections,
  } = config as Record<any, any>

  if (plugin !== pluginClass.name)
    throw new TypeError(
      `Expected "${pluginClass.name}" in 'plugin' field of config.`
    )

  if (typeof instance === 'string')
    throw new TypeError('Instance field of config must be a string.')

  if (typeof enabled !== 'boolean')
    throw new TypeError('Enabled field must be a boolean.')

  return {
    plugin: plugin,
    instance: instance,
    enabled: enabled,
    options: parseOptionsConfig(pluginClass.optionSpec, options ?? {}),
    commandAliases: parseCommandConfig(
      pluginClass.commandSpec,
      commandAliases ?? {}
    ),
    connections: parseConnectionsConfig(
      pluginClass.dependencySpec,
      connections ?? {}
    ),
  } as PluginConfig<typeof pluginClass>
}

export function parseOptionsConfig<T extends OptionSpec>(
  optionSpec: T,
  optionsConfig: unknown
) {
  if (typeof optionsConfig !== 'object' || Array.isArray(optionsConfig))
    throw new TypeError('Options must be a plain object.')

  const validatedOptions: Record<string, any> = {}

  for (const [option, spec] of Object.entries(optionSpec)) {
    const value = (optionsConfig as Record<any, any>)[option]

    if (value === undefined) {
      if (spec.default !== undefined) {
        validatedOptions[option] = spec.default
      } else {
        throw new Error(`Missing required option: ${option}`)
      }
    } else validatedOptions[option] = value
  }
  return validatedOptions as OptionsFromSpec<T>
}

export function parseCommandConfig<T extends CommandSpec>(
  commandSpec: T,
  commandAliasesConfig: unknown
) {
  if (
    typeof commandAliasesConfig !== 'object' ||
    Array.isArray(commandAliasesConfig)
  )
    throw new TypeError('commandAliasesConfig must be a plain object.')

  const validatedCommandAliases: Record<string, string[]> = {}

  for (const [command, spec] of Object.entries(commandSpec)) {
    const aliases = (commandAliasesConfig as Record<string, any>)[command]

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
  return validatedCommandAliases as CommandAliasFromSpec<T>
}

export function parseConnectionsConfig<T extends DependencySpec>(
  dependencySpec: T,
  connectionConfig: unknown
) {
  if (typeof connectionConfig !== 'object' || Array.isArray(connectionConfig))
    throw new TypeError('dependencyConfig must be a plain object.')

  const validatedConnections: Record<string, string> = {}

  for (const [dep, spec] of Object.entries(dependencySpec)) {
    const value = (connectionConfig as Record<string, any>)[dep]

    if (value == undefined) {
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
  return validatedConnections as ConnectionsFromSpec<T>
}
