import Stream from 'stream'

import type { Logger } from '@logtape/logtape'

import { Client, type ConnectConfig, type SFTPWrapper, type Stats } from 'ssh2'
import { LogReader } from './log-reader-base.js'

export class SFTPLogReader extends LogReader {
  client: Client
  sftp?: SFTPWrapper
  statsCache?: Stats
  filePollTimeout: NodeJS.Timeout | undefined
  pollInterval: number = 1000
  options: ConnectConfig
  constructor(path: string, options: ConnectConfig, logger: Logger) {
    super(path, logger)
    this.options = options
    this.client = new Client()
  }

  protected async connect() {
    this.client.connect(this.options)
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    this.client.sftp((err, sftp) => {
      if (err) {
        reject(err)
      } else {
        this.sftp = sftp
        resolve()
      }
    })
    await promise
  }

  protected disconnect() {
    this.sftp?.end()
    this.client?.end()
  }

  protected async waitForChange() {
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    const pollUntilChange = async () => {
      if (this.abortController.signal.aborted) reject()
      const size = await this.getSize()
      if (size !== this.lastSize) {
        this.lastSize = size
        resolve()
      } else {
        this.filePollTimeout = setTimeout(pollUntilChange, this.pollInterval)
      }
    }
    pollUntilChange()
    return promise
  }

  getStream(offset: number): Stream.Readable {
    return this.sftp!.createReadStream(this.path, { start: offset })
  }

  protected async getSize(useCache = false) {
    if (!useCache || !this.statsCache) await this.getFileStats()
    return this.statsCache!.size
  }

  async getFileStats() {
    const { promise, resolve, reject } = Promise.withResolvers<Stats>()
    this.sftp?.stat(this.path, (err, stats) => {
      if (err) {
        reject(err)
      } else {
        this.statsCache = stats
        resolve(stats)
      }
    })
    return promise
  }
}
