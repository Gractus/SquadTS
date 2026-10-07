import BasePlugin, { type OptionSpec } from './base-plugin.js'

import { Sequelize } from 'sequelize'

export default class SequelizeClient extends BasePlugin<
  typeof SequelizeClient
> {
  client: Sequelize | null = null

  static description = `Used to create clients for a variety of databases.
Intended to be used as a connector for other plugins.

The connector should be configured using any of Sequelize's single argument configuration options.
For example:
\`\`\`json
  "mysql": "mysql://user:pass@example.com:5432/dbname"
\`\`\`

or:
\`\`\`json
  "sqlite": {
      "dialect": "sqlite",
      "storage": "path/to/database.sqlite"
  }
\`\`\`

See [Sequelize's documentation](https://sequelize.org/master/manual/getting-started.html#connecting-to-a-database) for more details.`

  static readonly optionSpec = {
    databaseURI: {
      description: 'URI for the database this client will connect to.',
      example: 'sqlite:database.sqlite' as string | object,
    },
  } satisfies OptionSpec

  async prepareToMount() {
    const database = this.config.options.databaseURI
    if (typeof database === 'string') {
      this.client = new Sequelize(database, {
        define: {
          charset: 'utf8mb4',
          collate: 'utf8mb4_unicode_ci',
        },
        logging: msg => this.log.info(msg),
      })
    } else if (typeof database === 'object') {
      this.client = new Sequelize({
        ...database,
        logging: msg => this.log.info(msg),
      })
    } else {
      throw new Error('Unknown sequelize connector config type.')
    }

    await this.client.authenticate()
  }

  async unmountCleanup(): Promise<void> {
    if (this.client !== null) await this.client.close()
  }
}
