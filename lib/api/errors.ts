/**
 * Base class for all known application errors.
 * Carry an explicit HTTP status code so the error handler can map them
 * directly to the correct response without any string-matching heuristics.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/** 400 — malformed request, invalid query params, failed validation */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400, 'BAD_REQUEST')
    this.name = 'BadRequestError'
  }
}

/** 401 — re-exported alias so callers can import from one place */
export { AuthError } from '@/lib/supabase/server'

/** 403 — authenticated but not permitted */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN')
    this.name = 'ForbiddenError'
  }
}

/** 404 — resource does not exist */
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

/** 422 — request understood but entity could not be processed */
export class UnprocessableError extends AppError {
  constructor(message = 'Unprocessable entity') {
    super(message, 422, 'UNPROCESSABLE_ENTITY')
    this.name = 'UnprocessableError'
  }
}
