import fs from 'fs'

import type { Logger } from '@logtape/logtape'

import type { PluginClass, PluginConfig } from './plugins/base-plugin.js'
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
  loadedPlugins: Map<PluginClass, Record<string, InstanceType<PluginClass>>> =
    new Map()
  constructor(server: SquadServer) {
    this.server = server
    this.log = this.server.logger.getChild('Plugin Manager')
  }

  async loadConfig(config: PluginConfig[]) {
    this.pluginRegistry = await loadPlugins()
    for (const rawPluginConfig of config) {
      if (
        typeof rawPluginConfig !== 'object' ||
        rawPluginConfig === null ||
        Array.isArray(rawPluginConfig)
      ) {
        throw new TypeError('Config must be a plain object.')
      }

      const { plugin, instance, enabled = true } = rawPluginConfig

      if (enabled !== true) {
        this.log.warn`Ignored disabled config for plugin: ${plugin}`
        continue
      }

      const Plugin = this.pluginRegistry.find(
        pluginClass => pluginClass.name === plugin
      )
      if (!Plugin)
        throw new Error(
          `Error parsing config: Plugin ${plugin} does not exist.`
        )

      const validConfig = Plugin.parseConfig(rawPluginConfig)

      const pluginInstances = this.configRegistry.get(Plugin) ?? {}

      if (instance in pluginInstances)
        throw new Error(
          `Duplicate instance ID: ${instance} for plugin: ${plugin}.`
        )

      pluginInstances[instance] = validConfig
      this.configRegistry.set(Plugin, pluginInstances)
    }

    // Fill in default config for plugins that are enabled by default.
    for (const Plugin of this.pluginRegistry) {
      if (Plugin.defaultEnabled) {
        const defaultConfig = Plugin.defaultConfig
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
        const loadedInstance = this.loadedPlugins.get(Plugin)?.[instance]
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
              this.loadedPlugins?.get(pluginType)?.[instance]
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
            const loadedInstances = this.loadedPlugins.get(Plugin) ?? {}
            loadedInstances[instance] = newPlugin
            this.loadedPlugins.set(Plugin, loadedInstances)
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
