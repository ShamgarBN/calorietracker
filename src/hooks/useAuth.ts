import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { syncNow } from '@/lib/sync'

function onSignedIn(_session: Session) {
  // Pull server state (incl. profile/targets) into the local cache. The profile
  // row is created lazily when the user first saves goals or changes a preference.
  void syncNow()
}

interface AuthState {
  session: Session | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setState({ session: data.session, loading: false })
      if (data.session) onSignedIn(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false })
      if (session) onSignedIn(session)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return state
}
