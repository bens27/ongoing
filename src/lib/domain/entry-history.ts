import { snapshotMetrics, type ProviderAvailability, type SnapshotMetric } from './metrics';

export const DEFAULT_HISTORY_DAYS = 90;
export const MAX_HISTORY_DAYS = 365;

/** A focused read, deliberately separate from the initial inventory's EntryView payload. */
export interface EntryHistory {
  entry: { id: string; kind: string; slug: string; name: string };
  metric: SnapshotMetric;
  /** Inclusive UTC calendar dates, including today. */
  window: { days: number; from: string; to: string };
  observations: HistoryObservation[];
  availability: {
    state: 'available' | 'empty' | 'unavailable';
    provider: 'github' | 'loc';
    providerStatus: ProviderAvailability | 'unknown';
    reason: string | null;
  };
  freshness: {
    state: 'fresh' | 'stale' | 'unknown';
    scannedAt: string | null;
    /** Latest valid dated snapshot across the metric's history, even outside this window. */
    latestSnapshotOn: string | null;
    maxAgeHours: number;
  };
  /** Malformed or missing dates cannot be placed on a chart. They are omitted, never invented. */
  omittedDates: number;
}

export interface HistoryObservation {
  capturedOn: string;
  /** A missing/non-finite value is unknown, never a zero. */
  value: number | null;
}

export class HistoryReadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 = 400
  ) {
    super(message);
    this.name = 'HistoryReadError';
  }
}

export function parseHistoryRequest(metric: unknown, days: unknown = DEFAULT_HISTORY_DAYS) {
  if (typeof metric !== 'string' || !snapshotMetrics.includes(metric as SnapshotMetric))
    throw new HistoryReadError(`metric must be one of ${snapshotMetrics.join(', ')}`);
  const count = typeof days === 'string' && /^\d+$/.test(days) ? Number(days) : days;
  if (
    typeof count !== 'number' ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_HISTORY_DAYS
  )
    throw new HistoryReadError(`days must be an integer from 1 to ${MAX_HISTORY_DAYS}`);
  return { metric: metric as SnapshotMetric, days: count };
}

export function historyWindow(days: number, now: Date): EntryHistory['window'] {
  const to = now.toISOString().slice(0, 10);
  const start = Date.parse(to) - (days - 1) * 86_400_000;
  return { days, from: new Date(start).toISOString().slice(0, 10), to };
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

/** Preserve sparse/constant series and explicit nulls; never interpolate or pad missing days. */
export function historyObservations(
  snapshots: readonly { capturedOn: unknown; value: unknown }[],
  window: EntryHistory['window']
): Pick<EntryHistory, 'observations' | 'omittedDates'> & { latestSnapshotOn: string | null } {
  let omittedDates = 0;
  const dated: HistoryObservation[] = [];
  for (const snapshot of snapshots) {
    if (!isCalendarDate(snapshot.capturedOn)) {
      omittedDates++;
      continue;
    }
    if (snapshot.capturedOn > window.to) continue;
    dated.push({
      capturedOn: snapshot.capturedOn,
      value:
        typeof snapshot.value === 'number' && Number.isFinite(snapshot.value)
          ? snapshot.value
          : null
    });
  }
  dated.sort((left, right) => left.capturedOn.localeCompare(right.capturedOn));
  return {
    observations: dated.filter((point) => point.capturedOn >= window.from),
    latestSnapshotOn: dated.at(-1)?.capturedOn ?? null,
    omittedDates
  };
}
