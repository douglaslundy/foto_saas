import 'dotenv/config'
import { Worker, Job } from 'bullmq'
import { connection } from '../src/lib/queues/connection'
import type { WatermarkJobData } from '../src/lib/queues/watermark-queue'
import { faceIndexingQueue } from '../src/lib/queues/face-queue'
import { downloadOriginal, uploadPublic } from '../src/lib/storage'
import { applyWatermark, type WatermarkConfig } from '../src/lib/image/watermark'
import { generateThumbnail, generatePreview } from '../src/lib/image/resize'
import { createAdminClient } from '../src/lib/supabase/admin'

async function processWatermarkJob(job: Job<WatermarkJobData>): Promise<void> {
  const { photo_id, event_id, tenant_id, original_storage_path } = job.data
  const supabase = createAdminClient()

  try {
    await job.updateProgress(10)

    // 1. Load watermark config for the tenant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: wmConfig } = await (supabase as any)
      .from('watermark_configs')
      .select('type, text_content, font, font_size, color, opacity, position, image_storage_path, image_size_percent')
      .eq('tenant_id', tenant_id)
      .single()

    await job.updateProgress(20)

    // 2. Download original photo from private bucket
    const originalBuffer = await downloadOriginal(original_storage_path)

    await job.updateProgress(40)

    // 3. Apply watermark (if configured)
    let processedBuffer = originalBuffer
    if (wmConfig) {
      let watermarkImageBuffer: Buffer | undefined
      if (wmConfig.type === 'image' && wmConfig.image_storage_path) {
        watermarkImageBuffer = await downloadOriginal(wmConfig.image_storage_path)
      }
      processedBuffer = await applyWatermark(originalBuffer, wmConfig as WatermarkConfig, watermarkImageBuffer)
    }

    await job.updateProgress(60)

    // 4. Generate thumbnail (400px) and preview (1200px) with watermark applied
    const [thumbnailBuffer, previewBuffer] = await Promise.all([
      generateThumbnail(processedBuffer),
      generatePreview(processedBuffer),
    ])

    await job.updateProgress(75)

    // 5. Upload to public CDN bucket
    const basePath = original_storage_path.replace(/\.[^.]+$/, '')
    const thumbPath = `${basePath}_thumb.jpg`
    const previewPath = `${basePath}_preview.jpg`

    await Promise.all([
      uploadPublic(thumbnailBuffer, thumbPath),
      uploadPublic(previewBuffer, previewPath),
    ])

    await job.updateProgress(90)

    // 6. Update photo record in DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('photos')
      .update({
        status: 'ready',
        thumbnail_path: thumbPath,
        public_storage_path: previewPath,
      })
      .eq('id', photo_id)

    if (updateError) throw new Error(`DB update failed: ${updateError.message}`)

    await job.updateProgress(95)

    // 7. Enqueue face indexing job (processed by Python FastAPI in Plan 3)
    await faceIndexingQueue.add('index-faces', {
      photo_id,
      event_id,
      tenant_id,
      original_storage_path,
    })

    await job.updateProgress(100)
  } catch (err) {
    // Mark photo as error in DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('photos')
      .update({ status: 'error' })
      .eq('id', photo_id)
    throw err
  }
}

const worker = new Worker<WatermarkJobData>('watermark', processWatermarkJob, {
  connection,
  concurrency: 3,
})

worker.on('completed', (job) => {
  console.log(`[watermark-worker] ✓ job ${job.id} — photo ${job.data.photo_id}`)
})

worker.on('failed', (job, err) => {
  console.error(`[watermark-worker] ✗ job ${job?.id} — ${err.message}`)
})

worker.on('error', (err) => {
  console.error('[watermark-worker] Worker error:', err)
})

console.log('[watermark-worker] Started. Listening for jobs on queue "watermark"...')
