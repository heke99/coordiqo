/**
 * Maps technical errors (Postgres, Supabase, network, validation) to friendly
 * Swedish messages that are safe to show to customers. Raw database or system
 * errors must never reach end users.
 */

type ErrorLike = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

const GENERIC_MESSAGE = 'Något gick fel. Försök igen eller kontakta support om felet kvarstår.'

function extractError(error: unknown): ErrorLike {
  if (!error) return {}
  if (typeof error === 'string') return { message: error }
  if (error instanceof Error) {
    const anyError = error as Error & { code?: string; details?: string }
    return { message: anyError.message, code: anyError.code, details: anyError.details }
  }
  if (typeof error === 'object') {
    const anyError = error as ErrorLike
    return { message: anyError.message, code: anyError.code, details: anyError.details, hint: anyError.hint }
  }
  return {}
}

/**
 * Returns a customer-safe Swedish message for any thrown/returned error.
 * Messages that already are friendly Swedish validation errors (thrown by our
 * own actions) pass through unchanged.
 */
export function friendlyErrorMessage(error: unknown, fallback = GENERIC_MESSAGE): string {
  const { message = '', code = '' } = extractError(error)
  const lower = message.toLowerCase()

  // Postgres error codes (via PostgREST/Supabase).
  switch (code) {
    case '23505': // unique_violation
      return 'Det finns redan en post med samma uppgift.'
    case '23503': // foreign_key_violation
      return 'Valet går inte att spara eftersom en kopplad post saknas.'
    case '23502': // not_null_violation
      return 'Något i formuläret saknas. Kontrollera fälten och försök igen.'
    case '23514': // check_violation
      return 'Ett av värdena är inte giltigt. Kontrollera formuläret och försök igen.'
    case '22P02': // invalid_text_representation (e.g. invalid uuid)
      return 'Något i formuläret saknas eller är felvalt. Ladda om sidan och försök igen.'
    case '42501': // insufficient_privilege
      return 'Du saknar behörighet för den här åtgärden.'
    case 'PGRST116': // no rows returned for single()
      return 'Posten kunde inte hittas. Den kan ha tagits bort.'
    case 'PGRST301':
      return 'Du behöver logga in igen.'
  }

  // Message-based detection.
  if (lower.includes('duplicate key')) return 'Det finns redan en post med samma uppgift.'
  if (lower.includes('foreign key')) return 'Valet går inte att spara eftersom en kopplad post saknas.'
  if (lower.includes('invalid input syntax for type uuid') || lower.includes('invalid uuid')) {
    return 'Något i formuläret saknas eller är felvalt. Ladda om sidan och försök igen.'
  }
  if (lower.includes('violates check constraint') || lower.includes('violates not-null')) {
    return 'Något i formuläret saknas eller är felvalt. Kontrollera fälten och försök igen.'
  }
  if (lower.includes('jwt') || lower.includes('not authenticated') || lower.includes('auth session missing')) {
    return 'Du behöver logga in igen.'
  }
  if (lower.includes('permission denied') || lower.includes('row-level security')) {
    return 'Du saknar behörighet för den här åtgärden.'
  }
  if (
    lower.includes('fetch failed') ||
    lower.includes('network') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('socket hang up') ||
    lower.includes('failed to fetch')
  ) {
    return 'Det gick inte att nå tjänsten just nu. Försök igen.'
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'För många försök på kort tid. Vänta en stund och försök igen.'
  }

  // Our own validation errors are already written in Swedish and safe to show.
  if (isFriendlyMessage(message)) return message

  return fallback
}

/**
 * Heuristic: our own thrown validation errors are short Swedish sentences and
 * never contain technical identifiers. Anything else is treated as internal.
 */
function isFriendlyMessage(message: string): boolean {
  if (!message || message.length > 220) return false
  const technicalMarkers = [
    'supabase',
    'postgres',
    'pgrst',
    'sql',
    'uuid',
    'constraint',
    'relation "',
    'column ',
    'null value',
    'stack',
    'undefined',
    'TypeError',
    'fetch',
    'ECONN',
    'select',
    'insert into',
    'update ',
    'delete from',
    'company_id',
    'tenant',
    'rls',
    'policy',
    'service role',
    'token',
    'api key',
  ]
  const lower = message.toLowerCase()
  return !technicalMarkers.some((marker) => lower.includes(marker.toLowerCase()))
}

/**
 * Wraps an unknown error into an Error with a customer-safe Swedish message.
 * Use in server actions before surfacing errors to customer-facing UI.
 */
export function toFriendlyError(error: unknown, fallback = GENERIC_MESSAGE): Error {
  return new Error(friendlyErrorMessage(error, fallback))
}
