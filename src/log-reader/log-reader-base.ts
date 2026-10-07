import { Stream } from 'node:stream'

import SquadLogParser from './log-parser/log-parser.js'

export abstract class LogReader {
  parser: SquadLogParser = new SquadLogParser()
  events = this.parser.events
  byteCursor: number = 0
  lastModified?: Date
  maxWindowSize: number = 5 * 1000 * 1000 // 5MB
  abortController: AbortController = new AbortController()
  path: string

  constructor(path: string) {
    this.path = path
  }

  async start() {
    await this.connect()
    this.lastModified = await this.getLastModified()
    const size = await this.getSize()
    this.byteCursor = this.byteCursor = Math.max(0, size - this.maxWindowSize)
    // const stream = this.getStream(offset)
    // this.byteCursor += await this.parser.catchup(stream)
    this.watchLoop()
  }

  private async watchLoop() {
    while (!this.abortController.signal.aborted) {
      await this.waitForChange()
      const size = await this.getSize()
      if (this.byteCursor > size) {
        this.byteCursor = Math.max(0, size - this.maxWindowSize)
        this.parser.clearStore()
      }
      const stream = this.getStream(this.byteCursor)
      this.byteCursor += await this.parser.parseStream(stream)
    }
  }

  async stop() {
    this.abortController.abort()
    this.abortController = new AbortController()
    this.disconnect()
    this.parser.clearStore()
  }

  async connect() {}
  disconnect() {}
  abstract waitForChange(): Promise<void>
  abstract getSize(): Promise<number>
  abstract getLastModified(): Promise<Date>
  abstract getStream(offset: number): Stream.Readable
}
