import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// A single shared client. When env isn't configured yet we still create a client
// with placeholder values so imports don't throw; the AuthGate shows a setup screen.
// Note: no explicit type annotation — it would pin the schema generic to "public",
// but our tables live in a custom schema (env.dbSchema).
export const supabase = createClient(
  env.supabaseUrl || 'http://localhost:54321',
  env.supabaseAnonKey || 'public-anon-key-placeholder',
  {
    // App tables live in a dedicated schema so we can share a Supabase project.
    db: { schema: env.dbSchema },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
)
