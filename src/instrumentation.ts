export async function register() {
  // Only the Node.js server process should touch storage; skip the Edge runtime.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { BUCKETS } = await import('@/lib/storage')

  const supabase = createAdminClient()
  for (const [bucket, isPublic] of [
    [BUCKETS.ORIGINAL, false],
    [BUCKETS.PUBLIC, true],
  ] as const) {
    const { error } = await supabase.storage.createBucket(bucket, { public: isPublic })
    if (error && !/already exists/i.test(error.message)) {
      console.error(`[instrumentation] failed to ensure bucket "${bucket}":`, error.message)
    }
  }
}
