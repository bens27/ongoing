<script lang="ts">
  import Badge from '../Badge.svelte';
  import { fullDate, relativeAge, shortDate, wholeNumber } from '../format';
  import Icon from '../Icon.svelte';
  import type { WorkSummary } from '../overview';
  import Disclosure from './Disclosure.svelte';

  /** Work in motion: the open issues, pull requests, and td items, with the td split behind it. */
  let {
    work,
    now,
    open = $bindable(false)
  }: { work: WorkSummary; now: number; open?: boolean } = $props();

  let githubUnavailable = $derived(
    work.githubAvailability && work.githubAvailability !== 'available'
      ? work.githubAvailability.replace('_', ' ')
      : null
  );
  let githubCollected = $derived(work.github.state !== 'never' && !githubUnavailable);
  let tdCollected = $derived(work.tdFreshness.state !== 'never');
</script>

<Disclosure title="Work in motion" icon="list" bind:open>
  {#snippet summary()}
    {#if githubUnavailable}
      <span>GitHub {githubUnavailable}</span>
    {:else if githubCollected}
      <span>{wholeNumber(work.openIssues)} issues</span>
      <span>·</span>
      <span>{wholeNumber(work.openPrs)} pull request{work.openPrs === 1 ? '' : 's'}</span>
    {:else}
      <span>GitHub not collected</span>
    {/if}
    <span>·</span>
    {#if tdCollected}
      <span>{wholeNumber(work.td.total)} td items</span>
    {:else}
      <span>td not collected</span>
    {/if}
    {#if work.tdFreshness.state === 'stale' || work.github.state === 'stale'}
      <Badge tone="warn">stale</Badge>
    {/if}
  {/snippet}

  {#if tdCollected}
    <dl class="split">
      <div>
        <dd class="u-mono">{wholeNumber(work.td.inProgress)}</dd>
        <dt>in progress</dt>
      </div>
      <div>
        <dd class="u-mono">{wholeNumber(work.td.blocked)}</dd>
        <dt>blocked</dt>
      </div>
      <div>
        <dd class="u-mono">{wholeNumber(work.td.review)}</dd>
        <dt>in review</dt>
      </div>
      <div>
        <dd class="u-mono">{wholeNumber(work.td.open)}</dd>
        <dt>open</dt>
      </div>
      <div>
        <dd class="u-mono">{wholeNumber(work.td.stale)}</dd>
        <dt>stale</dt>
      </div>
    </dl>
    <p class="meta" title={fullDate(work.tdFreshness.observedAt)}>
      td observed {relativeAge(work.tdFreshness.observedAt, now)} ago
    </p>
  {:else}
    <p>No td data has been collected; `td` may not be initialised in this repository.</p>
  {/if}

  {#if githubCollected}
    <p>
      {#if work.externalPrs}
        {wholeNumber(work.externalPrs)} external pull request{work.externalPrs === 1 ? '' : 's'}
        awaiting review{#if work.oldestExternalPrAt}; oldest opened {shortDate(
            work.oldestExternalPrAt
          )}{/if}.
      {:else if work.externalPrs === 0}
        No external pull requests awaiting review.
      {/if}
      {#if work.draftPrs}
        {wholeNumber(work.draftPrs)} draft{work.draftPrs === 1 ? '' : 's'}.
      {/if}
    </p>
    <div class="links">
      {#if work.issuesUrl}
        <a href={work.issuesUrl} target="_blank" rel="noreferrer"
          >Issues <Icon name="external-link" size={10} /></a
        >
      {/if}
      {#if work.pullsUrl}
        <a href={work.pullsUrl} target="_blank" rel="noreferrer"
          >Pull requests <Icon name="external-link" size={10} /></a
        >
      {/if}
    </div>
    <p class="meta" title={fullDate(work.github.observedAt)}>
      GitHub observed {relativeAge(work.github.observedAt, now)} ago
    </p>
  {:else if githubUnavailable}
    <p>
      GitHub was {githubUnavailable} at the last scan, so issue and pull-request counts are unknown.
    </p>
  {/if}
</Disclosure>

<style>
  .split {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(var(--split-cell-min), 1fr));
    gap: var(--space-3);
    margin: 0 0 var(--space-2);
  }

  .split dd {
    margin: 0;
    color: var(--text-primary);
    font-size: var(--text-lg);
    font-weight: var(--weight-medium);
  }

  .split dt {
    font-size: var(--text-2xs);
  }

  p {
    margin: var(--space-2) 0 0;
  }

  .meta {
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
  }

  .links {
    display: flex;
    gap: var(--space-4);
    margin-top: var(--space-2);
  }

  .links a {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    border-bottom: var(--rule) solid var(--border-strong);
    color: var(--text-primary);
  }
</style>
