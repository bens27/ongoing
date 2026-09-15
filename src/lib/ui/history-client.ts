import { DEFAULT_HISTORY_DAYS, type EntryHistory } from '$lib/domain/entry-history';
import type { SnapshotMetric } from '$lib/domain/metrics';

/**
 * Browser read of the shared history contract. The URL, query, and JSON body are the same as
 * `GET /api/entries/:kind/:slug/history` and `ongoing history`. Cache keys include the entry's
 * collector timestamp so a scan that refreshes the row also refreshes the chart.
 */
export interface HistoryRequest {
  kind: string;
  slug: string;
  metric: SnapshotMetric;
  days?: number;
  scannedAt: string | null;
}

export function historyCacheKey(request: HistoryRequest): string {
  const days = request.days ?? DEFAULT_HISTORY_DAYS;
  return `${request.kind}/${request.slug}:${request.metric}:${days}:${request.scannedAt ?? 'never'}`;
}

export function historyPath(request: HistoryRequest): string {
  const days = request.days ?? DEFAULT_HISTORY_DAYS;
  const params = new URLSearchParams({ metric: request.metric, days: String(days) });
  return `/api/entries/${encodeURIComponent(request.kind)}/${encodeURIComponent(request.slug)}/history?${params}`;
}

export function createHistoryCache(fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)) {
  const cache = new Map<string, EntryHistory>();
  const inflight = new Map<string, Promise<EntryHistory>>();

  async function read(request: HistoryRequest): Promise<EntryHistory> {
    const response = await fetchImpl(historyPath(request));
    const body = (await response.json()) as EntryHistory & { error?: string };
    if (!response.ok) throw new Error(body.error ?? 'History could not be read');
    return body;
  }

  return {
    key: historyCacheKey,
    peek(request: HistoryRequest) {
      return cache.get(historyCacheKey(request));
    },
    load(request: HistoryRequest): Promise<EntryHistory> {
      const key = historyCacheKey(request);
      const hit = cache.get(key);
      if (hit) return Promise.resolve(hit);
      const pending = inflight.get(key);
      if (pending) return pending;
      const promise = read(request)
        .then((data) => {
          cache.set(key, data);
          return data;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, promise);
      return promise;
    },
    clear() {
      cache.clear();
      inflight.clear();
    }
  };
}

export const historyCache = createHistoryCache();
