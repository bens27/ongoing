<script lang="ts">
  import type { ProjectOverview } from '../overview';
  import ReachSignal from './ReachSignal.svelte';

  /**
   * The fact sheet's second column: Reach, always visible rather than behind a tab, since the
   * wide layout has the room the panel does not. `ReachSignal` renders the same body and chart
   * slot the panel's Reach tab uses — the data and its rules live there; this only frames it with
   * a section heading matching `ProjectSignals`' tab bar.
   */
  let {
    overview,
    now,
    chart
  }: {
    overview: ProjectOverview;
    now: number;
    chart?: import('svelte').Snippet;
  } = $props();
</script>

<section class="reach" aria-label="Reach" data-section="reach">
  <div class="head">
    <h3>Reach</h3>
    <span class="meta">collected</span>
  </div>
  <ReachSignal reach={overview.reach} {now} {chart} />
</section>

<style>
  .reach {
    padding: var(--space-3) var(--space-4) var(--space-4);
    border-top: var(--rule) solid var(--border-subtle);
  }

  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    padding-bottom: var(--space-2);
    border-bottom: var(--rule) solid var(--border-default);
  }

  h3 {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
  }

  .meta {
    color: var(--text-secondary);
    font-size: var(--text-2xs);
  }
</style>
