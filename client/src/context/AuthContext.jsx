import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const API_URL = import.meta.env.VITE_API_URL || ''

// Module-level token cache — updated by onAuthStateChange, read by apiFetch
// Avoids calling supabase.auth.getSession() (slow network call) on every request
let _cachedToken = null

// Keep cache warm whenever auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  _cachedToken = session?.access_token ?? null
})

export async function apiFetch(path, options = {}) {
  // Use cached token; if empty fall back to getSession (with 3s timeout)
  let token = _cachedToken
  if (!token) {
    try {
      const result = await Promise.race([
        supabase.auth.getSession(),
        new Promise(resolve => setTimeout(() => resolve({ data: { session: null } }), 3000))
      ])
      token = result.data?.session?.access_token ?? null
      _cachedToken = token
    } catch { /* no token */ }
  }

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    },
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
  })
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Safety net: if auth check takes > 5s for any reason, stop loading so the app doesn't hang
    const safetyTimeout = setTimeout(() => setLoading(false), 5000)

    // Listen for auth changes FIRST — Supabase fires INITIAL_SESSION synchronously
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      clearTimeout(safetyTimeout)
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    // Also call getSession as a fallback in case onAuthStateChange doesn't fire
    supabase.auth.getSession().then(({ data: { session } }) => {
      // onAuthStateChange should have already handled this, but just in case
      if (session === null) {
        clearTimeout(safetyTimeout)
        setLoading(false)
      }
    }).catch(() => {
      clearTimeout(safetyTimeout)
      setLoading(false)
    })

    return () => {
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      setProfile(data)
    } catch (e) {
      // Profile may not exist yet (during onboarding)
    } finally {
      setLoading(false)
    }
  }

  const signUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }, [])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }, [])

  const completeOnboarding = useCallback(async ({ userId: explicitUserId, username, displayName, markets, initialBalances }) => {
    // Get fresh session — React state may not have updated yet right after signUp
    const { data: { session: freshSession } } = await supabase.auth.getSession()
    const uid = explicitUserId ?? freshSession?.user?.id ?? user?.id
    if (!uid) throw new Error('Not authenticated')
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: { userId: uid, username, displayName, markets, initialBalances }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    await fetchProfile(user.id)
    return data
  }, [user])

  const refreshProfile = useCallback(() => {
    if (user) fetchProfile(user.id)
  }, [user])

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      signUp, signIn, signOut,
      completeOnboarding, refreshProfile,
      isOnboarded: !!profile
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
