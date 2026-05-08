import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const wsOpts = { realtime: { transport: ws } }

export function makeServiceClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    wsOpts
  )
}

export function makeAnonClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    wsOpts
  )
}

export function makeUserClient(token) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { ...wsOpts, global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}
