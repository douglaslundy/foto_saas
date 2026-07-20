import { Queue } from 'bullmq'
import { connection } from './connection'

export type WatermarkJobData = {
  photo_id: string
  event_id: string
  tenant_id: string
  original_storage_path: string
  // Presentes apenas quando a foto foi sobrescrita (re-upload após edição externa).
  // Apontam para os arquivos antigos, que só devem ser removidos do storage depois
  // que a nova versão terminar de processar com sucesso.
  previous_original_storage_path?: string
  previous_thumbnail_path?: string
  previous_public_storage_path?: string
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
