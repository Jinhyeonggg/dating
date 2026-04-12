import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean)

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return NextResponse.json({
    loggedIn: !!user,
    userId: user?.id ?? null,
    adminIds: ADMIN_IDS,
    isAdmin: user ? ADMIN_IDS.includes(user.id) : false,
    envRaw: process.env.ADMIN_USER_IDS ?? '(not set)',
  })
}
