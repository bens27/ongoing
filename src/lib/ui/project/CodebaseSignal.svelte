<script lang="ts">
  import Badge from '../Badge.svelte';
  import { compactNumber, fullDate, relativeAge, wholeNumber } from '../format';
  import type { CodebaseSummary } from '../overview';

  /**
   * How big it is: lines of code, files, language. Size is context for the other sections, never
   * a score — and the test-file line count is a size too, not coverage, which the label says.
   *
   * `chart` is the dated LOC-history slot. Size figures around it stay context, never a score.
   */
  let {
    codebase,
    now,
    chart
  }: {
    codebase: CodebaseSummary | null;
    now: number;
    chart?: import('svelte').Snippet;
  } = $props();
</script>

{#if !codebase}
  <p class="empty">The code-size collector has not run for this project.</p>
{:else}
  <div class="head">
    <div>
      <div class="headline u-mono" data-metric="loc" title={wholeNumber(codebase.locCode)}>
        {compactNumber(codebase.locCode)}
      </div>
      <div class="metric-label">lines of code</div>
    </div>
    <div class="aside">
      {#if codebase.language}<Badge tone="neutral">{codebase.language}</Badge>{/if}
      <span class="meta">{wholeNumber(codebase.files)} files</span>
    </div>
  </div>
  {#if chart}
    <div class="chart-slot" data-chart="codebase">{@render chart()}</div>
  {/if}
  <dl class="stats">
    <div>
      <dd class="u-mono">{compactNumber(codebase.locComment)}</dd>
      <dt>comment lines</dt>
    </div>
    <div>
      <dd class="u-mono">{compactNumber(codebase.locBlank)}</dd>
      <dt>blank lines</dt>
    </div>
    <div>
      <dd class="u-mono">{compactNumber(codebase.testLines)}</dd>
      <dt>lines in test files</dt>
    </div>
  </dl>
  <p class="meta note">
    Size describes the codebase; it is not a health, productivity, or test-coverage score.
  </p>
  <p
    class="meta"
    title={codebase.loc.state === 'never' ? undefined : fullDate(codebase.loc.observedAt)}
  >
    {#if codebase.loc.state === 'never'}
      Code size never observed
    {:else}
      Code size observed {relativeAge(codebase.loc.observedAt, now)} ago
      {#if codebase.loc.state === 'stale'}<Badge tone="warn">stale</Badge>{/if}
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
    font-size: var(--text-2xl);
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

  .note {
    margin-top: var(--space-3);
  }

  .note + .meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
</style>
