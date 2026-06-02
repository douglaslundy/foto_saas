import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function isSafeRedirect(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//') && !url.includes('\n') && !url.includes('\r')
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'
  const safeNext = isSafeRedirect(next) ? next : '/'

  const supabase = await createClient()

  // PKCE flow (Supabase SSR padrão)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`)
  }

  // OTP flow (fallback para GoTrue self-hosted)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`)
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
