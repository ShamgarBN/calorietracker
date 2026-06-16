// Centralised, validated access to build-time env vars.
// Supabase URL + anon key are safe to ship in a static client — Row Level Security
// is what actually protects the data, not secrecy of the anon key.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const schema = import.meta.env.VITE_DB_SCHEMA as string | undefined

export const env = {
  supabaseUrl: url ?? '',
  supabaseAnonKey: anonKey ?? '',
  /**
   * Postgres schema this app lives in. Defaults to `tracker` so the app can share
   * an existing Supabase project without colliding with its `public` tables.
   * Must match supabase/schema.sql AND the dashboard's "Exposed schemas" list.
   */
  dbSchema: schema || 'tracker',
  /** True once the app has been pointed at a real Supabase project. */
  get isConfigured() {
    return Boolean(this.supabaseUrl && this.supabaseAnonKey)
  },
}

if (!env.isConfigured && import.meta.env.DEV) {
  // Loud in dev, silent in prod build — the UI shows a setup screen instead.
  console.warn(
    '[calorie-tracker] Supabase env not set. Copy .env.example to .env.local and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. See README.',
  )
}
