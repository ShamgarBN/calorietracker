import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { syncNow } from '@/lib/sync'
import { ensureProfile } from '@/data/profile'

function onSignedIn(session: Session) {
  void ensureProfile(session.user.id, session.user.email).then(() => syncNow())
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
