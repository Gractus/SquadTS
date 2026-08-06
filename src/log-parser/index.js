import fs from 'fs';
import path from 'path';

import LogParser from './log-parser.js';
import Logger from '../common/logger.js';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), './events');
export default class SquadLogParser extends LogParser {
  constructor(options) {
    super('SquadGame.log', options);
    this._rules = [];
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
        this._rules.push(module.default);
      }
    }
  }

  // This should use a Loader in Vanilla SquadJS
  getRules() {
    return this._rules;
  }
}
