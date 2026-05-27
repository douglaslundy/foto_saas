import { Queue } from 'bullmq'
import { connection } from './connection'

export type FaceIndexingJobData = {
  photo_id: string
  event_id: string
  tenant_id: string
  original_storage_path: string
}

// Jobs enqueued here will be processed by the Python FastAPI service (Plan 3)
export const faceIndexingQueue = new Queue<FaceIndexingJobData>('face-indexing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
})
