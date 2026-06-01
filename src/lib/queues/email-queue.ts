import { Queue } from 'bullmq'
import { connection } from './connection'

export type EmailJobData =
  | {
      type: 'order_confirmation'
      to: string
      orderId: string
      totalCents: number
      downloadUrl: string
      studioName?: string
    }
  | {
      type: 'sale_notification'
      to: string
      orderId: string
      totalCents: number
      clientEmail: string
      studioName?: string
    }

export const emailQueue = new Queue<EmailJobData>('email', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
})
