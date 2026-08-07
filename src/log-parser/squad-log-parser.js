import fs from 'fs';
import path from 'path';

import LogParser from './base-log-parser.js';
import Logger from '../common/logger.js';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), './events');
export default class SquadLogParser extends LogParser {
  constructor(options) {
    super('SquadGame.log', options);

    this.eventStore = {
      disconnected: {}, // holding area, cleared on map change.
      players: {}, // persistent data, steamid, controller, suffix.
      session: {}, // old eventstore, nonpersistent data
      joinRequests: []
    };
  }

  async watch() {
    // ? Wait for rules to be configured before hooking the log file
    await this.setupRules();
    return super.watch();
  }

  async setupRules() {
    const files = await fs.promises.opendir(path.resolve(__dirname));
    for await (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.js')) continue;
      Logger.verbose('SquadLogParser', 1, `Loading parser file ${file.name}...`);
      const module = await import(pathToFileURL(path.join(__dirname, file.name)).href);
      if ('default' in module && 'regex' in module.default && 'onMatch' in module.default) {
        this.rules.push(module.default);
      }
    }
  }

  // manage cleanup disconnected players, session data.
  clearEventStore() {
    Logger.verbose('LogParser', 2, 'Cleaning Eventstore');
    for (const player of Object.values(this.eventStore.players)) {
      if (this.eventStore.disconnected[player.eosID] === true) {
        Logger.verbose('LogParser', 2, `Removing ${player.eosID} from eventStore`);
        delete this.eventStore.players[player.eosID];
        delete this.eventStore.disconnected[player.eosID];
      }
    }
    this.eventStore.session = {};
  }
}
