import Stream from 'stream'

import { Client, type ConnectConfig, type SFTPWrapper, type Stats } from 'ssh2'
import { LogReader } from './log-reader-base.js'

export class SFTPLogReader extends LogReader {
  client: Client
  sftp?: SFTPWrapper
  statsCache?: Stats
  filePollTimeout: NodeJS.Timeout | undefined
  pollInterval: number = 1000
  options: ConnectConfig
  constructor(path: string, options: ConnectConfig) {
    super(path)
    this.options = options
    this.client = new Client()
  }

  async connect() {
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

  disconnect() {
    this.sftp?.end()
    this.client?.end()
  }

  async waitForChange() {
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    const pollUntilChange = async () => {
      if (this.abortController.signal.aborted) reject()
      const lastMod = new Date((await this.getFileStats()).mtime)
      if (lastMod !== this.lastModified) {
        this.lastModified = lastMod
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

  async getLastModified() {
    return new Date((await this.getFileStats()).mtime)
  }

  async getSize(useCache = true) {
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
