import EventEmitter from 'events'
import fs from 'fs'
import Stream from 'stream'

import type { Logger } from '@logtape/logtape'
import RE2 from 're2'

import { SimpleDynamicBuffer } from '../../common/buffer.js'
import type {
  ExternalIDs,
  InGameIDs,
  ToEventEmitterMap,
} from '../../common/types.js'
import type { Match } from './events/match-transitions.js'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LogEvents {}

type RE2Set = ReturnType<typeof RE2.Set>

export interface Rule {
  pattern: RegExp
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => void
}

interface RuleRE2 {
  pattern: RE2
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => void
}

interface RuleSet {
  patternSet: RE2Set
  rules: RuleRE2[]
}

/**
 * All known info about an in game player.
 */
export interface Player extends InGameIDs, ExternalIDs {
  controller?: string
  ip?: string
}

interface Deployable {
  health: number
}

export interface EventStore {
  deployables: Map<string, Deployable>
  currentJoin?: Partial<Player>
  match: Partial<Match>
}

const EVENTS_DIR = new URL('./events/', import.meta.url)
const STAMP_PATTERN = new RE2(
  /^\[(?<time>\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2}:\d{3})]\[(?<chainID>[ \d]{3})\]/
)
const STAMP_LENGTH = '[2026.09.19-02.35.55:713][116]'.length

export default class SquadLogParser {
  log: Logger
  events: EventEmitter<ToEventEmitterMap<LogEvents>> = new EventEmitter()
  eventStore: EventStore = {
    deployables: new Map(),
    match: {},
  }
  ruleSet!: RuleSet
  constructor(logger: Logger) {
    this.log = logger
  }

  async loadRules() {
    const rules: RuleRE2[] = []

    const files = await fs.promises.opendir(EVENTS_DIR)
    for await (const file of files) {
      if (
        !file.isFile() ||
        !(file.name.endsWith('.js') || file.name.endsWith('.ts'))
      )
        continue
      this.log.info`Loading parser event rule file ${file.name}...`
      const module = await import(EVENTS_DIR + file.name)

      const input = module.default as Rule | Rule[]
      if (Array.isArray(input)) {
        input.forEach(rule => {
          this.loadRule(rule, rules)
        })
      } else {
        this.loadRule(input, rules)
      }
    }

    this.ruleSet = {
      patternSet: RE2.Set(Array.from(rules, rule => rule.pattern)),
      rules: rules,
    }
  }

  loadRule(rule: Rule, rules: Rule[]) {
    if (!rule.pattern.source.startsWith('^')) {
      throw new Error(
        `Rule patterns MUST have a start-of-string anchor '^' but it is missing for pattern: "${rule.pattern}"`
      )
    }
    rules.push({
      pattern: new RE2(rule.pattern),
      action: rule.action,
    })
  }

  clearMatch() {
    this.log.info('Cleaning Current Match Data from EventStore')
    this.eventStore.match = {}
    this.eventStore.deployables.clear()
  }

  clearStore() {
    this.log.info('Cleaning EventStore')
    this.clearMatch()
  }

  async catchup(stream: Stream.Readable) {
    const emit = this.events.emit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.events.emit = (() => {}) as any
    const bytesConsumed = await this.parseStream(stream)
    this.events.emit = emit
    return bytesConsumed
  }

  /** Returns bytes consumed. */
  async parseStream(stream: Stream.Readable) {
    let totalBytesRead = 0
    const fragmentBuffer: SimpleDynamicBuffer = new SimpleDynamicBuffer(8192)

    // TODO Handle strings too?
    if (stream.readableEncoding !== null)
      throw new Error('Stream must work in buffers not strings!')

    for await (const chunk of stream) {
      let chunkSlice = chunk as Buffer

      if (fragmentBuffer.length !== 0) {
        let index = chunkSlice.indexOf(0x0a)
        // If there is no newline then copy the entire chunk.
        index = index === -1 ? chunkSlice.length : index + 1
        fragmentBuffer.append(chunkSlice, 0, index)
        chunkSlice = chunkSlice.subarray(index)
        totalBytesRead += this.parseBuffer(fragmentBuffer.subarray())
      }

      const bytesRead = this.parseBuffer(chunkSlice)
      // Copy the final line fragment to fragment buffer.
      fragmentBuffer.overwrite(chunkSlice, bytesRead)
      totalBytesRead += bytesRead
    }

    return totalBytesRead
  }

  /** Returns bytes consumed. */
  parseBuffer(buffer: Buffer) {
    let bytesConsumed = 0
    let endOfLine = buffer.indexOf(0x0a)
    if (endOfLine === -1) return bytesConsumed
    else endOfLine += 1
    let line = buffer.subarray(bytesConsumed, endOfLine)

    while (bytesConsumed < buffer.length) {
      // As a (semi-pointless) micro-optimisation to avoid regex matching every single timestamp even for lines we don't care about
      // we use a subarray to cut out the timestamp and only get that if it turns out this line matches.
      const matchedRules = this.ruleSet.patternSet.match(
        line.subarray(STAMP_LENGTH)
      )

      if (matchedRules.length > 0) {
        if (matchedRules.length > 1) {
          throw new Error(
            'Pattern ruleset includes either duplicate patterns or rules that are not specific enough to differentiate.'
          )
        }

        const stampMatch = STAMP_PATTERN.exec(line)
        const time = new Date(
          stampMatch!
            .groups!.time.toString()
            .replace(
              /^(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2}):(\d{3})/,
              '$1-$2-$3T$4:$5:$6.$7'
            )
        )
        const chainID = +stampMatch!.groups!.chainID.toString()

        const rule = this.ruleSet.rules[matchedRules[0]]
        const match = rule.pattern.exec(line.subarray(STAMP_LENGTH))!
        const groups: Record<string, string> = {}
        if (match.groups) {
          for (const [key, value] of Object.entries(match.groups)) {
            if (value) groups[key] = value.toString()
          }
        }
        rule.action(time, chainID, groups, this)
      }
      bytesConsumed = endOfLine
      endOfLine = buffer.indexOf(0x0a, bytesConsumed + STAMP_LENGTH)
      if (endOfLine === -1) break
      else endOfLine += 1
      line = buffer.subarray(bytesConsumed, endOfLine)
    }

    return bytesConsumed
  }
}
