import { createReadStream } from 'node:fs'
import SquadLogParser from './log-parser.js'
import { getLogger } from '@logtape/logtape'

const parser = new SquadLogParser(getLogger())
await parser.loadRules()

// const stream = createReadStream('C:/Users/Gordon/Source Projects/h0kjrx9.log', {
//   highWaterMark: 4096 * 1024,
// })
const stream = createReadStream('C:/Users/Gordon/Source Projects/h0kjrx9.log')

const t0 = performance.now()
const bytesRead = await parser.parseStream(stream)
const megaBytes = bytesRead / (1024 * 1024)
const t1 = performance.now()
const seconds = (t1 - t0) / 1000
const bytesPerSecond = megaBytes / seconds

console.log(
  `Parsed ${megaBytes} MB in ${seconds} seconds. MB/s: ${bytesPerSecond}`
)
