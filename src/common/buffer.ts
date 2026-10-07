export class PreAllocatedBuffer {
  protected buffer: Buffer
  protected stored: number = 0

  constructor(size: number) {
    this.buffer = Buffer.allocUnsafe(size)
  }

  get length(): number {
    return this.stored
  }

  get size() {
    return this.buffer.length
  }

  subarray(start: number = 0, end?: number) {
    const safeEnd = Math.max(end ?? 0, this.stored)
    return this.buffer.subarray(start, safeEnd)
  }

  append(source: Buffer, start?: number, end?: number) {
    return this.writeBytes(source, start, end, this.stored)
  }

  overwrite(source: Buffer, start?: number, end?: number) {
    return this.writeBytes(source, start, end, 0)
  }

  writeBytes(
    source: Buffer,
    sourceStart: number = 0,
    sourceEnd: number = source.length,
    offset: number = 0
  ) {
    const bytesCopied = source.copy(this.buffer, offset, sourceStart, sourceEnd)
    this.stored = offset + bytesCopied
    return bytesCopied
  }

  clear() {
    this.stored = 0
  }
}

export class SimpleDynamicBuffer extends PreAllocatedBuffer {
  growthFactor: number = 1.5

  writeBytes(
    source: Buffer,
    sourceStart: number = 0,
    sourceEnd: number = source.length,
    offset: number = 0
  ) {
    if (this.buffer.length - offset < this.length + (sourceEnd - sourceStart)) {
      const newBuffer = Buffer.allocUnsafe(
        this.buffer.length * this.growthFactor
      )
      this.buffer.copy(newBuffer, 0, 0, this.stored)
    }
    return super.writeBytes(source, sourceStart, sourceEnd, offset)
  }
}
