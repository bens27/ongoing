import { describe, expect, it, vi } from 'vitest';
import type { EntryHistory } from '$lib/domain/entry-history';
import { createHistoryCache, historyCacheKey, historyPath } from './history-client';

const alpha: EntryHistory = {
  entry: { id: 'a', kind: 'project', slug: 'alpha', name: 'alpha' },
  metric: 'github_stars',
  window: { days: 90, from: '2026-06-17', to: '2026-09-14' },
  observations: [{ capturedOn: '2026-09-14', value: 120 }],
  availability: {
    state: 'available',
    provider: 'github',
    providerStatus: 'available',
    reason: null
  },
  freshness: {
    state: 'fresh',
    scannedAt: '2026-09-14T11:00:00Z',
    latestSnapshotOn: '2026-09-14',
    maxAgeHours: 72
  },
  omittedDates: 0
};

const beta: EntryHistory = {
  ...alpha,
  entry: { id: 'b', kind: 'project', slug: 'beta', name: 'beta' },
  observations: []
};

describe('history client', () => {
  it('builds the shared HTTP path and caches by entry, metric, window, and collector freshness', () => {
    const request = {
      kind: 'project',
      slug: 'alpha',
      metric: 'github_stars' as const,
      scannedAt: '2026-09-14T11:00:00Z'
    };
    expect(historyPath(request)).toBe(
      '/api/entries/project/alpha/history?metric=github_stars&days=90'
    );
    expect(historyCacheKey(request)).toBe('project/alpha:github_stars:90:2026-09-14T11:00:00Z');
    expect(historyCacheKey({ ...request, scannedAt: null })).toBe(
      'project/alpha:github_stars:90:never'
    );
  });

  it('fetches once per cache key and refetches when collector freshness changes', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => alpha })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...alpha, omittedDates: 1 }) });
    const cache = createHistoryCache(fetchImpl as unknown as typeof fetch);
    const request = {
      kind: 'project',
      slug: 'alpha',
      metric: 'github_stars' as const,
      scannedAt: '2026-09-14T11:00:00Z'
    };
    const first = await cache.load(request);
    const second = await cache.load(request);
    expect(first).toBe(second);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/entries/project/alpha/history?metric=github_stars&days=90'
    );

    const refreshed = await cache.load({ ...request, scannedAt: '2026-09-14T12:00:00Z' });
    expect(refreshed.omittedDates).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('shares an in-flight request and does not cache a failed read', async () => {
    let finish: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    const first = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
      finish = resolve;
    });
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'History is not supported for entry kind: technology' })
      });
    const cache = createHistoryCache(fetchImpl as unknown as typeof fetch);
    const request = {
      kind: 'project',
      slug: 'alpha',
      metric: 'github_stars' as const,
      scannedAt: 't1'
    };
    const a = cache.load(request);
    const b = cache.load(request);
    finish!({ ok: true, json: async () => alpha });
    expect(await a).toEqual(alpha);
    expect(await b).toEqual(alpha);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await expect(
      cache.load({
        kind: 'technology',
        slug: 'go',
        metric: 'loc_code',
        scannedAt: null
      })
    ).rejects.toThrow('History is not supported for entry kind: technology');
    expect(
      cache.peek({ kind: 'technology', slug: 'go', metric: 'loc_code', scannedAt: null })
    ).toBe(undefined);
  });

  it('keeps two entries’ responses distinct so a late load cannot be mistaken for the current one', async () => {
    let finishAlpha: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    const delayed = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
      finishAlpha = resolve;
    });
    const fetchImpl = vi.fn((url: string) => {
      if (String(url).includes('/alpha/')) return delayed;
      return Promise.resolve({ ok: true, json: async () => beta });
    });
    const cache = createHistoryCache(fetchImpl as unknown as typeof fetch);
    const alphaReq = {
      kind: 'project',
      slug: 'alpha',
      metric: 'github_stars' as const,
      scannedAt: 't1'
    };
    const betaReq = {
      kind: 'project',
      slug: 'beta',
      metric: 'github_stars' as const,
      scannedAt: 't1'
    };
    const late = cache.load(alphaReq);
    const current = await cache.load(betaReq);
    finishAlpha!({ ok: true, json: async () => alpha });
    expect(current.entry.slug).toBe('beta');
    expect((await late).entry.slug).toBe('alpha');
    expect(cache.peek(alphaReq)?.entry.slug).toBe('alpha');
    expect(cache.peek(betaReq)?.entry.slug).toBe('beta');
  });
});
