import { Queue } from 'bullmq'
import { connection } from './connection'

export type WatermarkJobData = {
  photo_id: string
  event_id: string
  tenant_id: string
  original_storage_path: string
}

export const watermarkQueue = new Queue<WatermarkJobData>('watermark', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
})
