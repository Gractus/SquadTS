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

  protected async connect() {
    await this.client.access(this.accessOptions)
  }

  protected disconnect() {
    this.client.close()
  }

  protected async waitForChange() {
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    const pollUntilChange = async () => {
      if (this.abortController.signal.aborted) reject()
      const size = await this.client.size(this.path)
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

  protected async getSize() {
    return this.client.size(this.path)
  }

  protected getStream(start: number): Stream.Readable {
    const stream = new PassThrough()
    this.client.downloadTo(stream, this.path, start)
    return stream
  }
}
