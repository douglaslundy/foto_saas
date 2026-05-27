import { createAdminClient } from '@/lib/supabase/admin'

const DOWNLOAD_URL_EXPIRY_SECONDS = 60 * 60 * 24 // 24 hours

type DownloadUrl = {
  photoId: string
  url: string
  expiresAt: string
}

export async function generateDownloadUrls(photoIds: string[]): Promise<DownloadUrl[]> {
  if (photoIds.length === 0) return []

  const adminClient = createAdminClient()

  // Fetch original storage paths
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos, error } = await (adminClient as any)
    .from('photos')
    .select('id, original_storage_path')
    .in('id', photoIds)

  if (error || !photos) {
    console.error('[delivery] fetch photos error:', error)
    return []
  }

  const results: DownloadUrl[] = []

  for (const photo of photos) {
    if (!photo.original_storage_path) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: signError } = await (adminClient as any).storage
      .from('photos-original')
      .createSignedUrl(photo.original_storage_path, DOWNLOAD_URL_EXPIRY_SECONDS)

    if (signError || !data?.signedUrl) {
      console.error('[delivery] sign url error for', photo.id, signError)
      continue
    }

    const expiresAt = new Date(Date.now() + DOWNLOAD_URL_EXPIRY_SECONDS * 1000).toISOString()
    results.push({ photoId: photo.id, url: data.signedUrl, expiresAt })
  }

  return results
}
