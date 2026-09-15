<script lang="ts">
  import { DEFAULT_HISTORY_DAYS, type EntryHistory } from '$lib/domain/entry-history';
  import type { SnapshotMetric } from '$lib/domain/metrics';
  import { shapeHistoryChart, type ShapedChart } from '../chart';
  import { historyCache } from '../history-client';
  import DatedChart from './DatedChart.svelte';

  /**
   * Lazy dated history for one visible signal. The overview is already on screen; this loads
   * independently, caches by entry/metric/window/freshness, and ignores a response that arrives
   * after the selected project or metric has moved on.
   */
  let {
    kind,
    slug,
    metric,
    scannedAt,
    unit,
    days = DEFAULT_HISTORY_DAYS
  }: {
    kind: string;
    slug: string;
    metric: SnapshotMetric;
    scannedAt: string | null;
    unit: string;
    days?: number;
  } = $props();

  let status: 'loading' | 'ready' | 'error' = $state('loading');
  let record: EntryHistory | null = $state(null);
  let error: string | null = $state(null);
  let reducedMotion = $state(false);

  $effect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = media.matches;
    const onChange = () => (reducedMotion = media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  });

  $effect(() => {
    const request = { kind, slug, metric, days, scannedAt };
    let cancelled = false;
    const cached = historyCache.peek(request);
    if (cached) {
      record = cached;
      error = null;
      status = 'ready';
      return;
    }
    status = 'loading';
    record = null;
    error = null;
    void historyCache.load(request).then(
      (data) => {
        if (cancelled) return;
        record = data;
        status = 'ready';
      },
      (reason: unknown) => {
        if (cancelled) return;
        error = reason instanceof Error ? reason.message : 'History could not be read';
        status = 'error';
      }
    );
    return () => {
      cancelled = true;
    };
  });

  let chart: ShapedChart | null = $derived(record ? shapeHistoryChart(record, { unit }) : null);
  let chartState: string = $derived(
    status === 'loading' ? 'loading' : status === 'error' ? 'error' : (chart?.state ?? 'empty')
  );
</script>

<div
  class="history"
  data-history-metric={metric}
  data-chart-state={chartState}
  data-motion={reducedMotion ? 'reduce' : 'full'}
>
  {#if status === 'loading'}
    <p class="empty">Loading dated observations…</p>
  {:else if status === 'error'}
    <p class="empty">{error}</p>
  {:else if chart?.state === 'unavailable'}
    <p class="empty">{chart.summary}</p>
  {:else if chart?.state === 'empty'}
    <p class="empty">{chart.summary}</p>
  {:else if chart}
    <DatedChart {chart} {reducedMotion} />
  {/if}
</div>

<style>
  .empty {
    margin: 0;
    padding: var(--space-3) 0;
    color: var(--text-secondary);
    font-size: var(--text-xs);
  }
</style>
