import fs from 'fs'
import * as fsPromises from 'fs/promises'

import type { Logger } from '@logtape/logtape'

import { LogReader } from './log-reader-base.js'

export class LocalLogReader extends LogReader {
  busy: boolean = false
  pending: boolean = false
  watcher: fs.FSWatcher | undefined
  constructor(path: string, logger: Logger) {
    super(path, logger)
  }

  protected connect() {
    this.watcher = fs.watch(this.path)
    return Promise.resolve()
  }

  protected disconnect() {
    this.watcher?.close()
  }

  protected waitForChange() {
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    const onChange = async () => {
      this.abortController.signal.removeEventListener('abort', onAbort)
      this.watcher!.removeListener('error', onError)
      resolve()
    }
    const onAbort = () => {
      this.watcher!.removeListener('change', onChange)
      this.watcher!.removeListener('error', onError)
      reject()
    }
    const onError = (err: Error) => {
      this.abortController.signal.removeEventListener('abort', onAbort)
      this.watcher!.removeListener('change', onChange)
      reject(err)
    }
    this.abortController.signal.addEventListener('abort', onAbort)
    this.watcher!.once('change', onChange)
    this.watcher!.once('error', onError)
    return promise
  }

  protected getStream(start: number) {
    return fs.createReadStream(this.path, { start: start })
  }

  protected async getSize() {
    return (await fsPromises.stat(this.path)).size
  }
}
