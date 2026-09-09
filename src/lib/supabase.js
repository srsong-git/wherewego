import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true,
      },
    })
  : null

export function getUserDisplayName(user) {
  const metadata = user?.user_metadata || {}
  return metadata.name
    || metadata.nickname
    || metadata.full_name
    || metadata.user_name
    || metadata.preferred_username
    || '방문자'
}

export function isAnonymousUser(user) {
  if (!user) return false
  if (typeof user.is_anonymous === 'boolean') return user.is_anonymous
  return user.app_metadata?.provider === 'anonymous'
    || user.app_metadata?.providers?.includes('anonymous')
}

export function isPermanentUser(user) {
  return Boolean(user) && !isAnonymousUser(user)
}
