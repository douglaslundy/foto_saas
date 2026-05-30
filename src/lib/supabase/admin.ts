// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// NEVER expose this client to the browser — use only in server actions / API routes
// Uses SUPABASE_INTERNAL_URL when available (Docker internal network) to avoid routing
// storage/auth calls through the external IP, which is not reachable from inside the container.
export function createAdminClient() {
  const url = process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
  return createClient<Database>(
    url,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
