import { type InspectColor } from 'node:util'

const LogLevel = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
} as const
type LogLevel = (typeof LogLevel)[keyof typeof LogLevel]

interface LoggerConfig {
  verboseness: Record<string, number>
  colors: Record<string, InspectColor>
  includeTimestamps: boolean
}

class Logger {
  name: string
  config?: LoggerConfig
  constructor(config?: LoggerConfig, name?: string) {
    this.config = config
    this.name = name ?? ''
  }

  write(verbosity: number, message: string) {
    // TODO Fix this.
    console.log(message)
  }

  fatal(message: string) {
    this.write(LogLevel['fatal'], message)
  }
  error(message: string) {
    this.write(LogLevel['error'], message)
  }
  warn(message: string) {
    this.write(LogLevel['warn'], message)
  }
  info(message: string) {
    this.write(LogLevel['info'], message)
  }
  debug(message: string) {
    this.write(LogLevel['debug'], message)
  }
  trace(message: string) {
    this.write(LogLevel['trace'], message)
  }

  child(name: string) {
    return new Logger(this.config, name)
  }
}

export default new Logger()
