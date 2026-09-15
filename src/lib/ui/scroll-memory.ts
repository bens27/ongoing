const PREFIX = 'ongoing:list-scroll:';

/**
 * A useful scroll position for the inventory list, kept only long enough to return to it — the
 * fact sheet's "returns to the inventory with … scroll position intact" requirement. Keyed by the
 * exact href (path and search) the list was showing, so it restores only when the query, sort,
 * columns, and selected entry it was captured under are the same ones the return link carries;
 * anything else is a fresh list and starts at the top like normal browsing. `sessionStorage` scopes
 * it to the tab and survives the client-side navigation to and from `/p/<slug>`; a read consumes
 * the entry, so a stale value cannot reapply itself to an unrelated later visit.
 */

export function rememberListScroll(href: string, scrollTop: number): void {
  try {
    sessionStorage.setItem(PREFIX + href, String(scrollTop));
  } catch {
    // Storage can be unavailable (private browsing, disabled site data); losing scroll memory
    // there is fine — the list just opens at the top.
  }
}

export function recallListScroll(href: string): number | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + href);
    if (raw === null) return null;
    sessionStorage.removeItem(PREFIX + href);
    return Number(raw);
  } catch {
    return null;
  }
}
