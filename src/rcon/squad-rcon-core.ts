import net from 'net'
import util from 'node:util'

import type { Logger } from '@logtape/logtape'

import { PreAllocatedBuffer, SimpleDynamicBuffer } from '../common/buffer.js'

const PacketType = {
  SERVERDATA_EXEC_COMMAND: 0x02,
  SERVERDATA_RESPONSE_VALUE: 0x00,
  SERVERDATA_AUTH: 0x03,
  SERVERDATA_AUTH_RESPONSE: 0x02,
  SERVERDATA_EVENT_VALUE: 0x01,
} as const
type PacketType = (typeof PacketType)[keyof typeof PacketType]

const PacketSubType = {
  AUTHENTICATION_FAILED: -0x01,
  PARTIAL_PAYLOAD: 0x01,
  END_PAYLOAD: 0x02,
} as const
type PacketSubType = (typeof PacketSubType)[keyof typeof PacketSubType]

export interface RconOptions {
  host: string
  port: number
  password: string
  autoReconnect?: boolean
  autoReconnectInterval?: number
}

export interface Packet {
  size: number
  type: number
  subtype: number
  id: number
  body: Buffer
}

interface PayloadBuffer {
  id: number | null
  buffer: SimpleDynamicBuffer
}

const MAXIMUM_PACKET_SIZE = 4096
const MINIMUM_PACKET_SIZE = 14
const BROKEN_PACKET_CONTENTS = Buffer.from('\x00\x00\x00\x01\x00\x00\x00')

export default abstract class SquadRconCore {
  log: Logger
  host: string
  port: number
  password: string
  /** If true, client will automatically try to reconnect if connection drops.*/
  autoReconnect: boolean
  /** Time in ms between reconnect attempts*/
  isConnected: boolean
  autoReconnectDelay: number
  autoReconnectPending: boolean
  private autoReconnectTimeout: NodeJS.Timeout | undefined
  private authenticated: boolean
  private client: net.Socket
  private count: number
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private pendingCommands: Map<number, Function>
  private payloadBuffer: PayloadBuffer
  private packetFragmentBuffer: PreAllocatedBuffer = new PreAllocatedBuffer(
    MAXIMUM_PACKET_SIZE
  )
  constructor(options: RconOptions, logger: Logger) {
    this.log = logger
    this.host = options.host
    this.port = options.port
    this.password = options.password

    // internal variables
    this.authenticated = false
    this.autoReconnectPending = false
    this.autoReconnect = options.autoReconnect ?? true
    this.autoReconnectDelay = options.autoReconnectInterval ?? 5000

    // Used in auto reconnect timeout
    this.connectSocket = this.connectSocket.bind(this)
    this.authenticate = this.authenticate.bind(this)
    // Used as socket event handlers
    this.cleanupOnClose = this.cleanupOnClose.bind(this)
    this.retryConnect = this.retryConnect.bind(this)
    this.onData = this.onData.bind(this)

    this.payloadBuffer = { id: null, buffer: new SimpleDynamicBuffer(8192) }

    // Used For tracking Callbacks
    this.pendingCommands = new Map()
    this.count = 1

    // setup socket
    this.client = new net.Socket()
    this.isConnected = false
    this.client.on('close', this.cleanupOnClose)
    this.client.on('error', err => {
      this.log.error`Connection error: ${err}`
    })
    this.client.on('data', this.onData)
  }

  private onData(data: Buffer) {
    this.log.trace`Got data: ${this.bufToHexString(data)}`;

    let remainingData = data

    // Handle packet fragment from last data event.
    if (this.packetFragmentBuffer.length !== 0) {
      const originalFragmentLength = this.packetFragmentBuffer.length
      this.packetFragmentBuffer.append(data)

      const bytesRead = this.readPacketsFromBuffer(
        this.packetFragmentBuffer.subarray()
      )
      if (bytesRead instanceof Error) return
      const portionFromData = bytesRead - originalFragmentLength
      remainingData = data.subarray(portionFromData)
    }

    const bytesRead = this.readPacketsFromBuffer(remainingData)
    if (bytesRead instanceof Error) return
    remainingData = remainingData.subarray(bytesRead)

    // Copy any remaining bytes into the packet fragment buffer
    this.packetFragmentBuffer.overwrite(remainingData)
  }

  private readPacketsFromBuffer(buffer: Buffer) {
    let totalBytesRead = 0
    let bufferSlice = buffer

    while (bufferSlice.length > 4) {
      const size = buffer.readInt32LE(0)
      const packetSize = size + 4

      if (
        packetSize > MAXIMUM_PACKET_SIZE ||
        packetSize < MINIMUM_PACKET_SIZE
      ) {
        this.log.error('Implausible packet size. Stream is likely de-synced.')
        this.resetConnection()
        return new Error('Invalid packet size. Stream is likely de-synced.')
      }

      /**
       * ------------- Handle a bug in Squad RCON Protocol -------------
       * The packet following an empty packet will report a size of 10 (14 including the size header bytes), but it should report 17 long (21 including the size header bytes).
       * Therefore, if the packet is 10 in size and there's enough data for it to be a longer packet then we need to probe to check it's this broken packet.
       */
      const probePacketSize = 21
      if (size === 10 && bufferSlice.length >= 21) {
        // Copy the section of the incoming data of interest
        const probeBuf = bufferSlice.subarray(0, probePacketSize)
        // Check whether body matches
        const decodedProbePacket = this.decodePacket(probeBuf)
        // if (decodedProbePacket.body.toString() === '\x00\x00\x00\x01\x00\x00\x00') {
        if (decodedProbePacket.body.equals(BROKEN_PACKET_CONTENTS)) {
          // Ignore the broken packet from the incoming data
          bufferSlice = bufferSlice.subarray(probePacketSize)
          totalBytesRead += probePacketSize
          this.log.debug`Ignoring some data: ${this.bufToHexString(probeBuf)}`
          continue
        }
      }

      // If the packet hasn't been fully transmitted, return and wait for next data event.
      if (bufferSlice.length < packetSize) {
        this.log.debug(
          `Waiting for more data... Have: ${bufferSlice.length} Expected: ${packetSize}`
        )
        return 0
      }

      const packet = bufferSlice.subarray(0, packetSize)
      const decodedPacket = this.decodePacket(packet)
      this.handlePacket(decodedPacket)
      bufferSlice = bufferSlice.subarray(packetSize)
      totalBytesRead += packetSize
    }

    return totalBytesRead
  }

  private handlePacket(packet: Packet) {
    this.log.trace(`Processing decoded packet: {packet} {body}`, {
      packet: packet,
      body: packet.body.toString(),
    })

    const callBack = this.pendingCommands.get(packet.id)
    if (!callBack) {
      this.log.warn(
        `Received SERVERDATA_RESPONSE_VALUE with ID: ${packet.id} but there is no matching callback?`
      )
      return
    }
    switch (packet.type) {
      case PacketType.SERVERDATA_RESPONSE_VALUE:
        switch (packet.subtype) {
          case PacketSubType.PARTIAL_PAYLOAD:
            if (packet.id !== this.payloadBuffer.id) {
              this.payloadBuffer.id = packet.id
              this.payloadBuffer.buffer.clear()
            }
            this.payloadBuffer.buffer.append(packet.body)
            break

          case PacketSubType.END_PAYLOAD:
            this.payloadBuffer.buffer.append(packet.body)
            callBack(this.payloadBuffer.buffer.subarray().toString())
            this.payloadBuffer.buffer.clear()
            this.pendingCommands.delete(packet.id)
            break

          default:
            this.log.error(
              `Unknown packet subtype: ${packet.subtype} in: ${packet}`
            )
            this.resetConnection()
        }
        break

      case PacketType.SERVERDATA_AUTH_RESPONSE:
        callBack(packet.subtype)
        this.pendingCommands.delete(packet.id)
        break

      case PacketType.SERVERDATA_EVENT_VALUE:
        this.processRconEvent(packet.body.toString())
        break

      default:
        this.log.error(
          `Unknown packet type ${packet.type} in: ${this.decodedPacketToString(packet)}`
        )
        this.resetConnection()
    }
  }

  abstract processRconEvent(contents: string): void

  public executeCommand(command: string) {
    // if (this.client.readyState !== 'open') throw new Error('RCON socket is not connected.');
    if (!this.isConnected) return new Error('RCON socket is not connected.')
    if (!this.authenticated) return new Error('RCON not Logged in')

    this.log.debug`Sending command: ${command}`

    const encodedPacket = this.encodePacket(
      PacketType.SERVERDATA_EXEC_COMMAND,
      PacketSubType.END_PAYLOAD,
      command
    )
    if (encodedPacket.length > MAXIMUM_PACKET_SIZE)
      return new Error('Packet too long.')

    const { promise, resolve } = Promise.withResolvers<string | Error>()
    const callBack = (result: string | Error) => {
      resolve(result)
    }

    this.pendingCommands.set(this.count, callBack)
    this.incrementCount()

    this.log.trace`Sending packet: ${this.bufToHexString(encodedPacket)}`
    this.client.write(encodedPacket)

    return promise
  }

  protected connectSocket() {
    if (this.isConnected) throw new Error('Already Connected!')
    if (this.client.connecting)
      throw new Error('Connection attempt already in progress!')

    return new Promise<void>((resolve, reject) => {
      const rejectConnect = (err: Error) => {
        reject(err)
      }
      this.client.once('error', rejectConnect)
      this.client.connect(this.port, this.host, async () => {
        this.log.info`Connected to: ${this.host}:${this.port}`
        this.client.removeListener('error', rejectConnect)
        this.isConnected = true
        resolve()
      })
    })
  }

  protected async authenticate(password = this.password) {
    if (!this.isConnected) throw new Error('RCON socket is not connected')
    if (this.authenticated) throw new Error('Already authenticated!')

    const encodedPacket = this.encodePacket(
      PacketType.SERVERDATA_AUTH,
      PacketSubType.PARTIAL_PAYLOAD,
      password
    )

    const { promise, resolve, reject } = Promise.withResolvers<void>()
    const callBack = (result: number | Error) => {
      if (result === 1) resolve()
      if (result instanceof Error) reject(result)
      reject(new Error('RCON authentication failed. - Wrong Password?'))
    }

    this.pendingCommands.set(this.count, callBack)
    this.incrementCount()

    this.client.write(encodedPacket)

    await promise
    this.authenticated = true
  }

  protected async connect(password = this.password) {
    await this.connectSocket()
    try {
      await this.authenticate(password)
    } catch (err) {
      await this.disconnect()
      throw err
    }
    if (this.autoReconnect) this.client.once('close', this.retryConnect)
  }

  public disconnect() {
    this.client.removeListener('close', this.retryConnect)
    clearTimeout(this.autoReconnectTimeout)
    this.autoReconnectPending = false

    if (this.client.readyState === 'closed') {
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      this.log.info`Disconnecting from: ${this.host}:${this.port}`

      const onError = (err: Error) => {
        this.client.removeListener('close', onClose)
        reject(err)
      }
      const onClose = () => {
        this.client.removeListener('error', onError)
        resolve()
      }

      this.authenticated = false

      this.client.once('close', onClose)
      this.client.once('error', onError)
      this.client.end()
    })
  }

  public async resetConnection() {
    this.log.info`Resetting RCON client connection.`
    await this.disconnect()
    await this.connect()
  }

  private cleanupOnClose() {
    this.log.info`RCON client connection closed.`
    this.isConnected = false
    this.authenticated = false

    this.log.debug`Clearing Buffered Data`
    this.packetFragmentBuffer.clear()
    this.payloadBuffer.id = null
    this.payloadBuffer.buffer.clear()

    this.pendingCommands.forEach(callback =>
      callback(new Error('RCON connection closed.'))
    )
    this.pendingCommands.clear()
  }

  private retryConnect() {
    if (this.autoReconnectPending) {
      this.log.warn(
        'Reconnect is already pending. - Skipped setting reconnect timeout.'
      )
      return
    }
    this.autoReconnectPending = true
    const connectLoop = async () => {
      try {
        await this.connect()
        this.autoReconnectPending = false
      } catch {
        this.log
          .info`Sleeping ${this.autoReconnectDelay}ms before reconnecting.`
        this.autoReconnectTimeout = setTimeout(
          connectLoop,
          this.autoReconnectDelay
        )
      }
    }
    this.log.info`Sleeping ${this.autoReconnectDelay}ms before reconnecting.`
    this.autoReconnectTimeout = setTimeout(connectLoop, this.autoReconnectDelay)
  }

  private encodePacket(
    type: PacketType,
    id: PacketSubType,
    body: string,
    encoding: BufferEncoding = 'utf8'
  ) {
    const size = Buffer.byteLength(body) + 14
    const buf = Buffer.alloc(size)

    buf.writeUInt32LE(size - 4, 0)
    buf.writeUInt8(id, 4)
    buf.writeUInt8(0, 5)
    buf.writeUInt16LE(this.count, 6)
    buf.writeUInt32LE(type, 8)
    buf.write(body, 12, size - 2, encoding)
    buf.writeUInt16LE(0, size - 2)

    return buf
  }

  private decodePacket(packet: Buffer): Packet {
    return {
      size: packet.readUInt32LE(0),
      subtype: packet.readUInt8(4) as PacketSubType,
      id: packet.readUInt16LE(6),
      type: packet.readUInt32LE(8) as PacketType,
      body: packet.subarray(12, packet.byteLength - 2),
    }
  }

  private bufToHexString(buf: Buffer) {
    return buf.toString('hex').match(/../g)?.join(' ') ?? ''
  }

  private decodedPacketToString(decodedPacket: Packet) {
    return util.inspect(decodedPacket, { breakLength: Infinity })
  }

  private incrementCount() {
    if (this.count + 1 > 65535) this.count = 1
    this.count++
  }
}
