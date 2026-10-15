import fs from 'fs'
import { parseArgs } from 'node:util'
import path from 'path'

import { configureFromObject, type LogTapeConfig } from '@logtape/config'
import {
  configure,
  getAnsiColorFormatter,
  getConsoleSink,
} from '@logtape/logtape'

import { deepMerge } from './common/deep-merge.js'
import { printLogo } from './common/print-logo.js'
import SquadServer, { type ServerConfig } from './core/squad-server.js'

interface SquadJSConfig {
  server: ServerConfig
  logger?: LogTapeConfig
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

  if (!config.logger)
    await configure({
      sinks: {
        console: getConsoleSink({ formatter: getAnsiColorFormatter() }),
      },
      loggers: [
        {
          category: `Server ${config.server.id}`,
          lowestLevel: 'info',
          sinks: ['console'],
        },
        {
          category: [`Server ${config.server.id}`, 'RCON'],
          lowestLevel: 'info',
        },
        {
          category: [`Server ${config.server.id}`, 'Log Reader'],
          lowestLevel: 'info',
        },
      ],
    })
  else await configureFromObject(config.logger)

  const server = new SquadServer(config.server)
  await server.watch()
}

main()
