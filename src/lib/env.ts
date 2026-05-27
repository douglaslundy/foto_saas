function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  NEXT_PUBLIC_APP_URL: requireEnv('NEXT_PUBLIC_APP_URL'),
  NEXT_PUBLIC_ROOT_DOMAIN: requireEnv('NEXT_PUBLIC_ROOT_DOMAIN'),
  FACE_RECOGNITION_SERVICE_URL: process.env.FACE_RECOGNITION_SERVICE_URL ?? 'http://localhost:8000',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
} as const
