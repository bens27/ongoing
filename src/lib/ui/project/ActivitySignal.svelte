<script lang="ts">
  import Badge from '../Badge.svelte';
  import { fullDate, oneDecimal, percent, relativeAge, shortDate, wholeNumber } from '../format';
  import type { ActivitySummary } from '../overview';

  /**
   * Is it moving? Commits in 30 days lead, then three comparable average-rate bars derived from
   * the cumulative 7/30/90-day totals (`activityRates`), then the supporting counts. The bars are
   * averages over disjoint ranges — the collector keeps no per-day series, so nothing here draws
   * one — and every label says which days it covers.
   */
  let {
    activity,
    momentum,
    now
  }: {
    activity: ActivitySummary | null;
    /** Whether the entry is in the momentum view, which is the classifier's call, not ours. */
    momentum: boolean;
    now: number;
  } = $props();

  let rateSummary = $derived(
    activity?.rates.state === 'ok'
      ? `Average commits per day: ${activity.rates.bars
          .map((bar) => `${bar.label.toLowerCase()}, ${oneDecimal(bar.perDay)}`)
          .join('; ')}`
      : ''
  );
</script>

{#if !activity}
  <p class="empty">No git data has been collected for this project yet.</p>
{:else}
  <div class="head">
    <div>
      <div class="headline u-mono" data-metric="commits30d">{wholeNumber(activity.commits30d)}</div>
      <div class="metric-label">commits in 30 days</div>
    </div>
    <div class="aside">
      {#if momentum}<Badge tone="ok" dot>momentum</Badge>{/if}
      <p class="meta">
        {#if activity.activeDays30d === null}
          active days not collected
        {:else}
          {wholeNumber(activity.activeDays30d)} active days of 30
        {/if}
      </p>
    </div>
  </div>

  <div class="rates">
    <div class="rates-head">
      <span>Average commits / day</span>
      <span>Recent pace</span>
    </div>
    {#if activity.rates.state === 'ok'}
      <div class="bars" role="img" aria-label={rateSummary}>
        {#each activity.rates.bars as bar (bar.label)}
          <div class="bar-row">
            <span>{bar.label}</span>
            <div class="track">
              <div class="bar" style:width={`${Math.round(bar.share * 100)}%`}></div>
            </div>
            <span class="u-mono value">{oneDecimal(bar.perDay)}</span>
          </div>
        {/each}
      </div>
    {:else}
      <p class="meta unavailable">{activity.rates.reason}.</p>
    {/if}
  </div>

  <dl class="stats">
    <div>
      <dd class="u-mono">{wholeNumber(activity.commits7d)}</dd>
      <dt>commits · 7d</dt>
    </div>
    <div>
      <dd class="u-mono">
        {#if activity.githubAvailability && activity.githubAvailability !== 'available'}
          —
        {:else}
          {wholeNumber(activity.mergedPrs30d)}
        {/if}
      </dd>
      <dt>
        {#if activity.githubAvailability && activity.githubAvailability !== 'available'}
          PRs merged · GitHub {activity.githubAvailability.replace('_', ' ')}
        {:else}
          PRs merged · 30d
        {/if}
      </dt>
    </div>
    <div>
      <dd class="u-mono">{wholeNumber(activity.contributors)}</dd>
      <dt>git authors · all history</dt>
    </div>
  </dl>
  {#if activity.localAuthorShare30d !== null}
    <p class="meta">
      {percent(activity.localAuthorShare30d)} of the last 30 days’ commits are yours.
    </p>
  {/if}

  {#if activity.latestCommit}
    <p class="latest">
      {activity.latestCommit.subject ?? 'Latest commit'}<br />
      {#if activity.latestCommit.shortSha}
        <span class="u-mono meta">{activity.latestCommit.shortSha} · </span>
      {/if}
      <span class="meta">{shortDate(activity.latestCommit.at)} · latest captured commit</span>
    </p>
  {/if}

  <p
    class="meta observed"
    title={activity.git.state === 'never' ? undefined : fullDate(activity.git.observedAt)}
  >
    {#if activity.git.state === 'never'}
      Git never observed
    {:else}
      Git observed {relativeAge(activity.git.observedAt, now)} ago
      {#if activity.git.state === 'stale'}<Badge tone="warn">stale</Badge>{/if}
    {/if}
  </p>
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
    font-size: var(--text-xl);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-headline);
    line-height: 1.1;
  }

  .metric-label {
    margin-top: var(--space-1);
    color: var(--text-secondary);
    font-size: var(--text-xs);
  }

  .aside {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-2);
    text-align: right;
  }

  .rates {
    margin-top: var(--space-4);
  }

  .rates-head {
    display: flex;
    justify-content: space-between;
    color: var(--text-secondary);
    font-size: var(--text-2xs);
  }

  .bar-row {
    display: grid;
    grid-template-columns: var(--rate-label-width) 1fr var(--rate-value-width);
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-2);
    color: var(--text-secondary);
    font-size: var(--text-2xs);
  }

  .track {
    height: var(--track-height);
    background: var(--bg-inset);
  }

  .bar {
    height: 100%;
    background: var(--text-tertiary);
    transition: width var(--duration-normal) var(--ease-out);
  }

  .bar-row:last-child .bar {
    background: var(--text-primary);
  }

  .value {
    text-align: right;
  }

  .unavailable {
    margin-top: var(--space-2);
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

  .latest {
    margin: var(--space-3) 0 0;
    color: var(--text-secondary);
    font-size: var(--text-xs);
    line-height: var(--leading-normal);
    overflow-wrap: anywhere;
  }

  .observed {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
</style>
