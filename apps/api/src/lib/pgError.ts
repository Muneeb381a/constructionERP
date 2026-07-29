/**
 * Drizzle wraps the raw `pg` driver error in a DrizzleQueryError — the real Postgres
 * error code (e.g. "23503" foreign_key_violation) ends up on `err.cause.code`, not
 * `err.code` directly. Checking `err.code` alone silently misses every FK-violation
 * catch, letting it fall through to a generic 500 instead of the intended 409.
 */
export function pgErrorCode(err: unknown): string | undefined {
  const direct = (err as { code?: string } | undefined)?.code;
  if (direct) return direct;
  return (err as { cause?: { code?: string } } | undefined)?.cause?.code;
}
