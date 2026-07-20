import { createAdminClient } from '@/lib/supabase/admin'

const DOWNLOAD_URL_EXPIRY_SECONDS = 60 * 60 * 24 // 24 hours

type DownloadUrl = {
  photoId: string
  url: string
  expiresAt: string
}

// createAdminClient() usa SUPABASE_INTERNAL_URL (rede interna do Docker) para
// chamadas servidor-a-servidor. Signed URLs, porém, vão para o navegador do
// cliente, que não enxerga esse host — por isso trocamos pelo host público
// antes de devolver o link.
function toPublicUrl(internalUrl: string): string {
  const internalBase = process.env.SUPABASE_INTERNAL_URL
  const publicBase = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!internalBase || !publicBase || !internalUrl.startsWith(internalBase)) return internalUrl
  return publicBase + internalUrl.slice(internalBase.length)
}

export async function generateDownloadUrls(photoIds: string[]): Promise<DownloadUrl[]> {
  if (photoIds.length === 0) return []

  const adminClient = createAdminClient()

  // Fetch original and public (watermarked) storage paths
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos, error } = await (adminClient as any)
    .from('photos')
    .select('id, original_storage_path, public_storage_path')
    .in('id', photoIds)

  if (error || !photos) {
    console.error('[delivery] fetch photos error:', error)
    return []
  }

  const results: DownloadUrl[] = []

  for (const photo of photos) {
    if (!photo.original_storage_path) continue

    // Purchases must always expose the original image, never the watermarked version.
    const bucket = 'photos-original'
    const storagePath = photo.original_storage_path

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: signError } = await (adminClient as any).storage
      .from(bucket)
      .createSignedUrl(storagePath, DOWNLOAD_URL_EXPIRY_SECONDS)

    if (signError || !data?.signedUrl) {
      console.error('[delivery] sign url error for', photo.id, signError)
      continue
    }

    const expiresAt = new Date(Date.now() + DOWNLOAD_URL_EXPIRY_SECONDS * 1000).toISOString()
    results.push({ photoId: photo.id, url: toPublicUrl(data.signedUrl), expiresAt })
  }

  return results
}
