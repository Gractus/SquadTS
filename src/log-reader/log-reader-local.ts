import fs from 'fs'
import * as fsPromises from 'fs/promises'
import { LogReader } from './log-reader-base.js'

export class LocalLogReader extends LogReader {
  busy: boolean = false
  pending: boolean = false
  watcher: fs.FSWatcher | undefined
  constructor(path: string) {
    super(path)
  }

  connect() {
    this.watcher = fs.watch(this.path)
    return Promise.resolve()
  }

  disconnect() {
    this.watcher?.close()
  }

  waitForChange() {
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    const onChange = async () => {
      this.abortController.signal.removeEventListener('abort', onAbort)
      this.watcher!.removeListener('error', onChange)
      this.lastModified = await this.getLastModified()
      resolve()
    }
    const onAbort = () => {
      this.watcher!.removeListener('change', onChange)
      this.watcher!.removeListener('error', onChange)
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

  getStream(start: number) {
    return fs.createReadStream(this.path, { start: start })
  }

  async getSize() {
    return (await fsPromises.stat(this.path)).size
  }
  async getLastModified() {
    return (await fsPromises.stat(this.path)).mtime
  }
}
