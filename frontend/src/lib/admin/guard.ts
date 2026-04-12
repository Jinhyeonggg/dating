import { createClient } from '@/lib/supabase/server'
import { errors } from '@/lib/errors'

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean)

export async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw errors.unauthorized()
  if (!ADMIN_IDS.includes(user.id)) throw errors.forbidden()
  return user.id
}
