import Stream, { PassThrough } from 'node:stream'

import type { Logger } from '@logtape/logtape'

import { type AccessOptions, Client } from 'basic-ftp'
import { LogReader } from './log-reader-base.js'

export class FTPLogReader extends LogReader {
  client: Client
  filePollTimeout: NodeJS.Timeout | undefined
  pollInterval: number = 1000
  accessOptions: AccessOptions
  constructor(path: string, options: AccessOptions, logger: Logger) {
    super(path, logger)
    this.accessOptions = options
    this.client = new Client()
  }

  async connect() {
    await this.client.access(this.accessOptions)
  }

  disconnect() {
    this.client.close()
  }

  async waitForChange() {
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    const pollUntilChange = async () => {
      if (this.abortController.signal.aborted) reject()
      const lastMod = await this.client.lastMod(this.path)
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

  async getSize() {
    return this.client.size(this.path)
  }
  async getLastModified() {
    return this.client.lastMod(this.path)
  }

  getStream(start: number): Stream.Readable {
    const stream = new PassThrough()
    this.client.downloadTo(stream, this.path, start)
    return stream
  }
}
