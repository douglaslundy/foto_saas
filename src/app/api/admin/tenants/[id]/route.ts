import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params
    const adminClient = createAdminClient()

    // 1. Fetch all users belonging to this tenant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: users } = await (adminClient as any)
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId)

    // 2. Delete each GoTrue user
    for (const u of users ?? []) {
      await adminClient.auth.admin.deleteUser(u.id)
    }

    // 3. Delete the tenant record (CASCADE handles events, photos, orders)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (adminClient as any)
      .from('tenants')
      .delete()
      .eq('id', tenantId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
