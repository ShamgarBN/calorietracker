import { supabase } from '@/lib/supabase'
import { env } from '@/lib/env'

// In a shared Supabase project we deliberately avoid an auth.users signup trigger
// (it could collide with the host project, and wouldn't fire for an already-existing
// user anyway). Instead the app ensures its own profile row exists on login.
export async function ensureProfile(userId: string, email?: string | null): Promise<void> {
  if (!env.isConfigured) return
  try {
    const display = email ? email.split('@')[0] : null
    await supabase
      .from('profile')
      .upsert({ user_id: userId, display_name: display }, { onConflict: 'user_id', ignoreDuplicates: true })
  } catch {
    // Non-fatal: a missing profile row just means defaults until the next sync.
  }
}
