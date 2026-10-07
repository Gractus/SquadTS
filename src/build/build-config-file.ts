import fs from 'fs'
import path from 'path'
import { loadPlugins } from '../core/plugin-manager.js'

const TEMPLATE_PATH = path.resolve(
  import.meta.dirname,
  '../../templates/config-template.json'
)
const CONFIG_PATH = path.resolve(
  import.meta.dirname,
  '../../config/config.json'
)

console.log('Building config...')
buildConfig()
  .then(() => {
    console.log('Done.')
    return
  })
  .catch(console.log)

async function buildConfig() {
  const plugins = await loadPlugins()

  const templateString = fs.readFileSync(TEMPLATE_PATH, 'utf8')
  const template = JSON.parse(templateString)

  plugins.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  const pluginConfigs = []

  for (const plugin of plugins) {
    try {
      const config = plugin.defaultConfig
      pluginConfigs.push(config)
    } catch (error) {
      console.log(`Cannot create default config for ${plugin.name}: ${error}`)
    }
  }

  template.server.plugins = pluginConfigs

  const configString = JSON.stringify(template, null, 2)
  fs.writeFileSync(CONFIG_PATH, configString)
}
