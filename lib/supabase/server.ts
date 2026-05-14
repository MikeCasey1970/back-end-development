import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Thrown when a request arrives without a valid Supabase session.
 * Route handlers catch this specifically to return a 401 rather than a 500.
 */
export class AuthError extends Error {
  constructor(message = 'Unauthorized: no active session.') {
    super(message)
    this.name = 'AuthError'
  }
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — safe to ignore when middleware
            // is refreshing sessions.
          }
        },
      },
    },
  )
}

/**
 * Returns the authenticated user's ID (UUID) from the current session.
 * This doubles as the client_id for all tenant-scoped queries.
 * Throws if there is no active session.
 */
export async function getClientId(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new AuthError()
  }

  return user.id
}

/**
 * Server client using the service role key — bypasses RLS.
 * Use ONLY in trusted server-side contexts (e.g. admin API routes).
 */
export async function createServiceClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // no-op
          }
        },
      },
    },
  )
}
