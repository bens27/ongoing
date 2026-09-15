import { ATTENTION_THRESHOLDS } from '$lib/domain/attention';
import {
  HistoryReadError,
  historyObservations,
  historyWindow,
  parseHistoryRequest,
  type EntryHistory
} from '$lib/domain/entry-history';
import type { CollectionError, ProjectMetrics, SnapshotMetric } from '$lib/domain/metrics';
import type { CatalogRepository } from './repository';

type Source = {
  provider: 'github' | 'loc';
  collector: CollectionError['collector'];
  scannedAt: 'githubScannedAt' | 'githubTrafficScannedAt' | 'locScannedAt';
  availability?: 'githubAvailability' | 'githubTrafficAvailability';
  freshness: 'github' | 'traffic' | 'loc';
};

const hosting: Source = {
  provider: 'github',
  collector: 'hosting',
  scannedAt: 'githubScannedAt',
  availability: 'githubAvailability',
  freshness: 'github'
};
const traffic: Source = {
  provider: 'github',
  collector: 'traffic',
  scannedAt: 'githubTrafficScannedAt',
  availability: 'githubTrafficAvailability',
  freshness: 'traffic'
};
// Exhaustive against the existing snapshot registry: a newly collected metric needs provenance.
const sources: Record<SnapshotMetric, Source> = {
  github_stars: hosting,
  github_open_issues: hosting,
  github_open_prs: hosting,
  github_traffic_views: traffic,
  github_traffic_unique_visitors: traffic,
  github_traffic_clones: traffic,
  github_traffic_unique_cloners: traffic,
  loc_code: { provider: 'loc', collector: 'loc', scannedAt: 'locScannedAt', freshness: 'loc' }
};

function providerStatus(
  source: Source,
  metrics: ProjectMetrics | null
): EntryHistory['availability']['providerStatus'] {
  if (source.availability) return metrics?.[source.availability] ?? 'unknown';
  return metrics?.[source.scannedAt] ? 'available' : 'unknown';
}

/** One read boundary for HTTP and local clients. No catalog projection or collection is needed. */
export function readEntryHistory(
  repository: CatalogRepository,
  kind: string,
  slug: string,
  input: { metric: unknown; days?: unknown },
  now = new Date()
): EntryHistory {
  const { metric, days } = parseHistoryRequest(input.metric, input.days);
  if (kind !== 'project')
    throw new HistoryReadError(`History is not supported for entry kind: ${kind}`);
  const entry = repository.getEntryBySlug(kind, slug);
  if (!entry) throw new HistoryReadError(`Unknown entry: ${kind}/${slug}`, 404);

  const source = sources[metric];
  const metrics = repository.getMetrics(entry.id);
  const window = historyWindow(days, now);
  const { observations, latestSnapshotOn, omittedDates } = historyObservations(
    repository.listSnapshots(entry.id, metric),
    window
  );
  const scannedAt = metrics?.[source.scannedAt] ?? null;
  const timestamp = scannedAt === null ? NaN : Date.parse(scannedAt);
  const maxAgeHours = ATTENTION_THRESHOLDS.freshnessHours[source.freshness];
  const age = now.getTime() - timestamp;
  const freshness: EntryHistory['freshness'] = {
    state:
      !Number.isFinite(age) || age < 0
        ? 'unknown'
        : age <= maxAgeHours * 3_600_000
          ? 'fresh'
          : 'stale',
    scannedAt,
    latestSnapshotOn,
    maxAgeHours
  };
  let status = providerStatus(source, metrics);
  let reason: string | null =
    status === 'available' ? null : `${source.collector} provider status: ${status}`;
  if (repository.activeProviders && !repository.activeProviders.includes(source.provider)) {
    status = 'unavailable';
    reason = `${source.provider} provider is disabled or unavailable on this host`;
  } else {
    const error = repository
      .listCollectionErrors(entry.id, true)
      .find((error) => error.collector === source.collector);
    if (error) {
      if (status === 'available' || status === 'unknown') status = 'unavailable';
      reason = error.message;
    }
  }
  const state =
    status !== 'available'
      ? 'unavailable'
      : observations.some((point) => point.value !== null)
        ? 'available'
        : 'empty';
  if (state === 'empty') reason = 'No numeric observations in the requested window';
  return {
    entry: { id: entry.id, kind: entry.kind, slug: entry.slug, name: entry.name },
    metric,
    window,
    observations,
    availability: { state, provider: source.provider, providerStatus: status, reason },
    freshness,
    omittedDates
  };
}
