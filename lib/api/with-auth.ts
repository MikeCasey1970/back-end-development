import { NextRequest, NextResponse } from 'next/server'
import { getClientId } from '@/lib/supabase/server'
import { withErrorHandler, type RouteHandler } from '@/lib/api/with-error-handler'

/**
 * Wraps a Next.js Route Handler with session validation AND centralised error
 * handling (delegates to withErrorHandler).
 *
 * Verifies the Supabase session before invoking the handler. If the session
 * is missing or invalid, getClientId() throws AuthError which withErrorHandler
 * maps to a 401 — no duplication of catch logic.
 *
 * Usage (protected route):
 *   export const GET = withAuth(async (req) => {
 *     // session is guaranteed valid here
 *   })
 */
export function withAuth(handler: RouteHandler): RouteHandler {
  return withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
    // Validate session — throws AuthError if unauthenticated
    await getClientId()
    return handler(req)
  })
}
