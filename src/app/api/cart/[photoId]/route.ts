import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCartSession } from '@/lib/cart-session'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { photoId } = await params
  const { sessionId } = await getOrCreateCartSession()
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (adminClient as any)
    .from('cart_items')
    .delete()
    .eq('session_id', sessionId)
    .eq('photo_id', photoId)

  if (error) {
    console.error('[DELETE /api/cart/[photoId]]', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
