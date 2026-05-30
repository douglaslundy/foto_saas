import { createAdminClient } from '@/lib/supabase/admin'

export const BUCKETS = {
  ORIGINAL: 'photos-original',
  PUBLIC: 'photos-public',
} as const

export async function uploadOriginal(buffer: Buffer, storagePath: string, contentType = 'image/jpeg'): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.storage
    .from(BUCKETS.ORIGINAL)
    .upload(storagePath, buffer, { upsert: true, contentType })
  if (error) throw new Error(`Storage upload original failed: ${error.message}`)
}

export async function uploadPublic(buffer: Buffer, storagePath: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.storage
    .from(BUCKETS.PUBLIC)
    .upload(storagePath, buffer, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw new Error(`Storage upload public failed: ${error.message}`)
}

export async function downloadOriginal(storagePath: string): Promise<Buffer> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(BUCKETS.ORIGINAL)
    .download(storagePath)
  if (error || !data) throw new Error(`Storage download failed: ${error?.message}`)
  return Buffer.from(await data.arrayBuffer())
}

export function getPublicUrl(storagePath: string): string {
  const supabase = createAdminClient()
  const { data } = supabase.storage
    .from(BUCKETS.PUBLIC)
    .getPublicUrl(storagePath)
  return data.publicUrl
}

export async function createSignedDownloadUrl(
  storagePath: string,
  expiresInSeconds: number
): Promise<string> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(BUCKETS.ORIGINAL)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error || !data) throw new Error(`Signed URL creation failed: ${error?.message}`)
  return data.signedUrl
}
