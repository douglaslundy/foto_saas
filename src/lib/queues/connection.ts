import type { ConnectionOptions } from 'bullmq'

// BullMQ requires maxRetriesPerRequest: null on IORedis.
// We export a plain options object so BullMQ uses its own bundled ioredis,
// avoiding type conflicts when two ioredis versions coexist in node_modules.
export const connection: ConnectionOptions = {
  host: (() => {
    try {
      return new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').hostname
    } catch {
      return 'localhost'
    }
  })(),
  port: (() => {
    try {
      return parseInt(new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').port || '6379', 10)
    } catch {
      return 6379
    }
  })(),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
}
