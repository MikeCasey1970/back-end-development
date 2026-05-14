import { NextRequest, NextResponse } from 'next/server'
import { AuthError } from '@/lib/supabase/server'
import { AppError } from '@/lib/api/errors'

export type RouteHandler = (req: NextRequest) => Promise<NextResponse>

/**
 * Wraps any Next.js Route Handler with centralised, structured error handling.
 *
 * Error → HTTP status mapping:
 *   AuthError              → 401  (no/invalid session)
 *   AppError (subclasses)  → statusCode on the error instance (400, 403, 404, 422, …)
 *   Anything else          → 500  (unexpected / unhandled)
 *
 * All errors are logged server-side with enough context for Vercel log tracing.
 *
 * Usage (public route, no auth required):
 *   export const GET = withErrorHandler(async (req) => {
 *     // handler logic — throw AppError subclasses for known failure modes
 *   })
 */
export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(req)
    } catch (err) {
      // ── Auth failures ────────────────────────────────────────────────────
      if (err instanceof AuthError) {
        console.error(`[api] 401 ${req.method} ${req.nextUrl.pathname} — ${err.message}`)
        return NextResponse.json(
          { error: err.message, code: 'UNAUTHORIZED' },
          { status: 401 }
        )
      }

      // ── Known application errors (AppError and its subclasses) ──────────
      if (err instanceof AppError) {
        console.error(
          `[api] ${err.statusCode} ${req.method} ${req.nextUrl.pathname} — ${err.message}`
        )
        return NextResponse.json(
          { error: err.message, code: err.code ?? 'APP_ERROR' },
          { status: err.statusCode }
        )
      }

      // ── Unexpected errors ────────────────────────────────────────────────
      const message = err instanceof Error ? err.message : 'Internal server error'
      console.error(
        `[api] 500 ${req.method} ${req.nextUrl.pathname} — ${message}`,
        err
      )
      return NextResponse.json(
        { error: 'Internal server error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }
  }
}
