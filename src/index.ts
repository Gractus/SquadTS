import fs from 'fs'
import path from 'path'
import { parseArgs } from 'node:util'

import { deepMerge } from './common/deep-merge.js'
import { printLogo } from './common/print-logo.js'
import SquadServer, { type ServerConfig } from './core/squad-server.js'

interface SquadJSConfig {
  server: ServerConfig
  logger?: {
    verboseness: Record<string, number>
    colors: Record<string, string>
    timestamps?: boolean
  }
}

const CONFIG_DIR = path.resolve(import.meta.dirname, '../config/')

async function main() {
  await printLogo()

  const { values } = parseArgs({
    options: {
      'ignore-global': { type: 'boolean', short: 'i' },
      server: { type: 'string', short: 's' },
      configFile: { type: 'string', short: 'f' },
    },
  })

  if (values.configFile && values.server)
    throw new Error('Specify a server OR a config file.')

  let configString = ''

  if (values.configFile) {
    console.log(`Loading config file: ${values.configFile}`)
    configString = fs.readFileSync(values.configFile, 'utf8')
  } else if (values.server) {
    console.log(`Loading config file for ${values.server}`)
    configString = fs.readFileSync(
      path.resolve(CONFIG_DIR, values.server + '.json'),
      'utf8'
    )
  } else if (process.env.config) {
    console.log('Loading config found in env variables.')
  }

  let config: SquadJSConfig = JSON.parse(configString)

  if (!values['ignore-global']) {
    const globalConfig = JSON.parse(
      fs.readFileSync(path.resolve(CONFIG_DIR, 'global.json'), 'utf-8')
    )
    config = deepMerge(globalConfig, config) as SquadJSConfig
  }

  const server = new SquadServer(config.server)
  await server.watch()
}

main()
