import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { authStorage } from './authStorage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (legacy VITE_SUPABASE_PUBLISHABLE_KEY is accepted as a fallback).'
  )
}

if (!import.meta.env.VITE_SUPABASE_ANON_KEY && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.warn('VITE_SUPABASE_ANON_KEY is not set. Falling back to VITE_SUPABASE_PUBLISHABLE_KEY.')
}

export const supabaseKey = supabaseAnonKey

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: authStorage,
    storageKey: 'sf-auth-session',
  },
})
