<script lang="ts">
  import Badge from '../Badge.svelte';
  import { fullDate, relativeAge, signed, wholeNumber } from '../format';
  import type { ReachSummary } from '../overview';

  /**
   * Who else is looking: stars, forks, visitors, downloads. A private repository has no audience
   * to chart, so it shows the collected traffic window and nothing else; a provider that could
   * not answer says so, which is a different fact from "nobody came".
   *
   * `chart` is the dated star-history slot. Private repositories never render it; an unavailable
   * provider never reaches it either. The snippet owns fetch, loading, and empty/error copy.
   */
  let {
    reach,
    now,
    chart
  }: {
    reach: ReachSummary | null;
    now: number;
    chart?: import('svelte').Snippet;
  } = $props();

  let unavailable = $derived(
    reach?.availability && reach.availability !== 'available' ? reach.availability : null
  );
  let trafficUnavailable = $derived(
    reach?.traffic.availability && reach.traffic.availability !== 'available'
      ? reach.traffic.availability
      : null
  );
  let trafficCollected = $derived(Boolean(reach?.traffic.observedAt));
</script>

{#if !reach}
  <p class="empty">No hosting provider has reported on this project.</p>
{:else if unavailable}
  <p class="empty">
    GitHub is {unavailable.replace('_', ' ')}: reach was not collected.
    {#if reach.github.state !== 'never'}
      Last answer {relativeAge(reach.github.observedAt, now)} ago.
    {/if}
  </p>
{:else}
  {#if reach.visibility === 'private'}
    <div class="head">
      <div>
        <div class="title">Private repository</div>
        <div class="metric-label">No public audience to chart</div>
      </div>
      <Badge tone="neutral">limited audience</Badge>
    </div>
  {:else}
    <div class="head">
      <div>
        <div class="headline u-mono" data-metric="stars">{wholeNumber(reach.stars)}</div>
        <div class="metric-label">GitHub stars</div>
      </div>
      {#if reach.starsGained30d !== null}
        <Badge tone={reach.starsGained30d > 0 ? 'ok' : 'neutral'}
          >{signed(reach.starsGained30d)} in 30d</Badge
        >
      {:else}
        <span class="meta">no 30-day baseline yet</span>
      {/if}
    </div>
    {#if chart}
      <div class="chart-slot" data-chart="reach">{@render chart()}</div>
    {/if}
    <dl class="stats">
      <div>
        <dd class="u-mono">{wholeNumber(reach.forks)}</dd>
        <dt>forks</dt>
      </div>
      <div>
        <dd class="u-mono">{wholeNumber(reach.watchers)}</dd>
        <dt>watchers</dt>
      </div>
      <div>
        <dd class="u-mono">{wholeNumber(reach.releaseDownloads)}</dd>
        <dt>release downloads</dt>
      </div>
    </dl>
  {/if}

  {#if trafficUnavailable}
    <p class="meta traffic">
      Traffic: GitHub {trafficUnavailable.replace('_', ' ')}; not collected.
    </p>
  {:else if trafficCollected}
    <dl class="stats traffic">
      <div>
        <dd class="u-mono">{wholeNumber(reach.traffic.views)}</dd>
        <dt>views</dt>
      </div>
      <div>
        <dd class="u-mono">{wholeNumber(reach.traffic.uniqueVisitors)}</dd>
        <dt>unique visitors</dt>
      </div>
      <div>
        <dd class="u-mono">{wholeNumber(reach.traffic.clones)}</dd>
        <dt>clones</dt>
      </div>
    </dl>
    <p class="meta" title={fullDate(reach.traffic.observedAt)}>
      GitHub’s rolling 14-day traffic window, read {relativeAge(reach.traffic.observedAt, now)} ago.
    </p>
  {:else}
    <p class="meta traffic">Traffic has not been collected.</p>
  {/if}
{/if}

<style>
  .empty,
  .meta {
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--text-2xs);
  }

  .empty {
    padding: var(--space-3) 0;
    font-size: var(--text-xs);
  }

  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
    margin-top: var(--space-3);
  }

  .headline {
    font-size: var(--text-2xl);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-headline);
    line-height: 1.1;
  }

  .title {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .metric-label {
    margin-top: var(--space-1);
    color: var(--text-secondary);
    font-size: var(--text-xs);
  }

  .chart-slot {
    margin-top: var(--space-3);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin: var(--space-3) 0 0;
    padding-top: var(--space-3);
    border-top: var(--rule) solid var(--border-subtle);
  }

  .stats > div {
    padding-left: var(--space-3);
    border-left: var(--rule) solid var(--border-default);
    min-width: 0;
  }

  .stats > div:first-child {
    padding-left: 0;
    border-left: 0;
  }

  .stats dd {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--weight-medium);
  }

  .stats dt {
    margin-top: var(--space-1);
    color: var(--text-secondary);
    font-size: var(--text-2xs);
  }

  .traffic {
    margin-top: var(--space-3);
  }

  .stats + .meta {
    margin-top: var(--space-2);
  }
</style>
