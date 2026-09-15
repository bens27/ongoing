/**
 * A same-origin, in-app path safe to redirect or link to from an untrusted value — a query
 * parameter or similar. `/foo` is fine; `//evil.example` parses as a protocol-relative URL to
 * another host in a browser and an anchor, and must be refused the same way an open redirect
 * would be. Shared by the login flow's `returnTo` and the fact sheet's `from`, so the two cannot
 * drift on what counts as safe.
 */
export function safeReturnTo(value: string | null | undefined): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}
