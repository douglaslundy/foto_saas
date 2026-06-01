import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error } = await (admin as any)
    .from('orders')
    .select('id, status')
    .eq('id', id)
    .single()
  if (error || !order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ id: order.id, status: order.status })
}
