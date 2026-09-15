import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryReadError } from '$lib/domain/entry-history';
import { snapshotMetrics, type MetricSnapshot } from '$lib/domain/metrics';
import { CatalogDatabase } from './database';
import { CatalogRepository } from './repository';
import { readEntryHistory } from './history';

const now = new Date('2026-09-14T12:00:00Z');
let directory: string;
let database: CatalogDatabase;
let repository: CatalogRepository;
let id: string;

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'ongoing-history-'));
  database = new CatalogDatabase(join(directory, 'catalog.sqlite'));
  repository = new CatalogRepository(database, () => now.toISOString());
  const entry = await repository.upsertDiscovered({
    name: 'Example',
    canonicalPath: '/code/example',
    relativePath: 'example',
    scanRoot: '/code'
  });
  id = entry.id;
  await repository.updateMetrics(id, {
    githubAvailability: 'available',
    githubScannedAt: '2026-09-14T11:00:00Z',
    githubTrafficAvailability: 'available',
    githubTrafficScannedAt: '2026-09-10T00:00:00Z',
    locScannedAt: '2026-09-14T10:00:00Z'
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  database.close();
  rmSync(directory, { recursive: true, force: true });
});

function read(metric: unknown = 'github_stars', days?: unknown) {
  return readEntryHistory(repository, 'project', 'example', { metric, days }, now);
}

async function snapshot(
  capturedOn: string,
  value: number,
  metric: MetricSnapshot['metric'] = 'github_stars'
) {
  await repository.saveSnapshot({ projectId: id, metric, capturedOn, value });
}

describe('focused entry history', () => {
  it('distinguishes an empty window from unavailable collection, with identity and freshness', () => {
    expect(read()).toEqual({
      entry: { id, kind: 'project', slug: 'example', name: 'Example' },
      metric: 'github_stars',
      window: { days: 90, from: '2026-06-17', to: '2026-09-14' },
      observations: [],
      omittedDates: 0,
      availability: {
        state: 'empty',
        provider: 'github',
        providerStatus: 'available',
        reason: 'No numeric observations in the requested window'
      },
      freshness: {
        state: 'fresh',
        scannedAt: '2026-09-14T11:00:00Z',
        latestSnapshotOn: null,
        maxAgeHours: 72
      }
    });
  });

  it('returns a single zero and constant sparse observations in date order, without padding', async () => {
    await snapshot('2026-09-14', 0);
    expect(read().observations).toEqual([{ capturedOn: '2026-09-14', value: 0 }]);
    await snapshot('2026-09-03', 0);
    await snapshot('2026-09-11', 0);
    expect(read().observations).toEqual([
      { capturedOn: '2026-09-03', value: 0 },
      { capturedOn: '2026-09-11', value: 0 },
      { capturedOn: '2026-09-14', value: 0 }
    ]);
    expect(read().availability.state).toBe('available');
  });

  it('bounds inclusive UTC dates, filters metrics and future points, and reports older snapshots', async () => {
    await snapshot('2026-06-16', 1);
    await snapshot('2026-06-17', 2);
    await snapshot('2026-09-15', 3);
    await snapshot('2026-09-14', 500, 'loc_code');
    expect(read().observations).toEqual([{ capturedOn: '2026-06-17', value: 2 }]);
    expect(read('github_stars', 1)).toMatchObject({
      window: { days: 1, from: '2026-09-14', to: '2026-09-14' },
      observations: [],
      freshness: { latestSnapshotOn: '2026-06-17' },
      availability: { state: 'empty' }
    });
    expect(read('loc_code').observations).toEqual([{ capturedOn: '2026-09-14', value: 500 }]);
  });

  it('omits invalid/missing dates and keeps null/non-finite values unknown', () => {
    vi.spyOn(repository, 'listSnapshots').mockReturnValue([
      { capturedOn: null, value: 1 },
      { capturedOn: '', value: 2 },
      { capturedOn: '2026-06-31', value: 3 },
      { capturedOn: 'not-a-date', value: 4 },
      { capturedOn: '2026-09-10', value: null },
      { capturedOn: '2026-09-11', value: NaN },
      { capturedOn: '2026-09-14', value: Infinity }
    ] as unknown as MetricSnapshot[]);
    expect(read()).toMatchObject({
      observations: [
        { capturedOn: '2026-09-10', value: null },
        { capturedOn: '2026-09-11', value: null },
        { capturedOn: '2026-09-14', value: null }
      ],
      omittedDates: 4,
      availability: { state: 'empty' }
    });
  });

  it('retains cached observations for disabled providers and collection failures', async () => {
    await snapshot('2026-09-14', 23);
    repository.setActiveProviders(['loc']);
    expect(read()).toMatchObject({
      observations: [{ value: 23 }],
      availability: { state: 'unavailable', providerStatus: 'unavailable' }
    });
    repository.setActiveProviders(['github', 'loc']);
    await repository.recordCollectionError({
      projectId: id,
      collector: 'hosting',
      message: 'Request failed',
      occurredAt: now.toISOString()
    });
    expect(read()).toMatchObject({
      observations: [{ value: 23 }],
      availability: { state: 'unavailable', reason: 'Request failed' },
      freshness: { state: 'fresh' }
    });
    // An unrelated collector error cannot erase code-size availability.
    expect(read('loc_code').availability.state).toBe('empty');
  });

  it.each(['unavailable', 'unauthenticated', 'rate_limited'] as const)(
    'reports %s distinctly from an empty series',
    async (status) => {
      await repository.updateMetrics(id, { githubAvailability: status });
      expect(read().availability).toMatchObject({ state: 'unavailable', providerStatus: status });
    }
  );

  it('uses traffic-specific collection freshness and availability', async () => {
    expect(read('github_traffic_views').freshness).toMatchObject({
      state: 'stale',
      scannedAt: '2026-09-10T00:00:00Z'
    });
    await repository.updateMetrics(id, { githubTrafficAvailability: 'unauthenticated' });
    expect(read('github_traffic_views').availability).toMatchObject({
      state: 'unavailable',
      providerStatus: 'unauthenticated'
    });
    expect(read().availability.state).toBe('empty');
  });

  it('reports uncollected, invalid and future freshness as unknown', async () => {
    for (const scannedAt of [null, 'invalid', '2026-09-15T00:00:00Z']) {
      await repository.updateMetrics(id, { locScannedAt: scannedAt });
      expect(read('loc_code').freshness.state).toBe('unknown');
    }
    await repository.updateMetrics(id, { githubAvailability: null, githubScannedAt: null });
    expect(read().availability).toMatchObject({ state: 'unavailable', providerStatus: 'unknown' });
  });

  it('accepts every registered metric and rejects unsupported requests before reading snapshots', () => {
    for (const metric of snapshotMetrics) expect(read(metric).metric).toBe(metric);
    const snapshots = vi.spyOn(repository, 'listSnapshots');
    for (const days of [0, 366, -1, 1.5, '', '1.5', '1e2', '90x', true, null, NaN])
      expect(() => read('github_stars', days)).toThrow('days must be an integer from 1 to 365');
    for (const metric of [null, '', 'commits7d', 'invented'])
      expect(() => read(metric)).toThrow('metric must be one of');
    expect(() =>
      readEntryHistory(repository, 'technology', 'example', { metric: 'loc_code' }, now)
    ).toThrow('History is not supported');
    expect(() =>
      readEntryHistory(repository, 'project', 'missing', { metric: 'loc_code' }, now)
    ).toThrow(expect.objectContaining({ status: 404 }));
    expect(snapshots).not.toHaveBeenCalled();
    expect(() => read('github_stars', 0)).toThrow(HistoryReadError);
    expect(read('github_stars', '365').window.days).toBe(365);
  });

  it('does not read the full entry or legacy project catalogs', () => {
    const entries = vi.spyOn(repository, 'listEntries');
    const projects = vi.spyOn(repository, 'listProjects');
    read();
    expect(entries).not.toHaveBeenCalled();
    expect(projects).not.toHaveBeenCalled();
  });
});
