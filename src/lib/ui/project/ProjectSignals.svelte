<script lang="ts">
  import type { ProjectOverview } from '../overview';
  import ActivitySignal from './ActivitySignal.svelte';
  import CodebaseSignal from './CodebaseSignal.svelte';
  import ReachSignal from './ReachSignal.svelte';

  /**
   * The signals area. Activity is the default lens; Reach and Codebase are alternates behind
   * real tabs (one Tab stop, arrow keys between them). The active tab is bindable so the panel
   * can hold it per project and keep it through a background refresh.
   *
   * `reachChart` and `codebaseChart` are the dated-history boundary: a snippet each, rendered
   * inside the signal. Nothing in this component knows how history is fetched, which is the point.
   *
   * `tabs` restricts which lenses get a real tab, for the fact sheet's two-column layout: Reach
   * runs beside this component instead of behind it there, so the caller passes
   * `['activity', 'codebase']` and renders `ReachSection` itself. The default keeps all three for
   * the panel, where there is room for one lens at a time and not three side by side.
   */
  export type SignalTab = 'activity' | 'reach' | 'codebase';

  const ALL_TABS: { key: SignalTab; label: string }[] = [
    { key: 'activity', label: 'Activity' },
    { key: 'reach', label: 'Reach' },
    { key: 'codebase', label: 'Codebase' }
  ];

  let {
    overview,
    momentum,
    now,
    tab = $bindable<SignalTab>('activity'),
    tabs = ALL_TABS.map((item) => item.key),
    reachChart,
    codebaseChart
  }: {
    overview: ProjectOverview;
    /** Whether the entry is in the momentum view — the classifier's call, shown as a badge. */
    momentum: boolean;
    now: number;
    tab?: SignalTab;
    tabs?: SignalTab[];
    reachChart?: import('svelte').Snippet;
    codebaseChart?: import('svelte').Snippet;
  } = $props();

  let visibleTabs = $derived(ALL_TABS.filter((item) => tabs.includes(item.key)));

  let list = $state<HTMLDivElement | null>(null);

  function onkeydown(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = visibleTabs.findIndex((candidate) => candidate.key === tab);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? visibleTabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : visibleTabs.length - 1)) %
            visibleTabs.length;
    tab = visibleTabs[next].key;
    list?.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`)?.focus();
  }
</script>

<section class="signals" aria-label="Project signals" data-section="signals">
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div class="tabs" role="tablist" aria-label="Project signals" bind:this={list} {onkeydown}>
    {#each visibleTabs as item (item.key)}
      <button
        role="tab"
        type="button"
        id={`signal-tab-${item.key}`}
        data-tab={item.key}
        aria-selected={tab === item.key}
        aria-controls="signal-panel"
        tabindex={tab === item.key ? 0 : -1}
        onclick={() => (tab = item.key)}
      >
        {item.label}
      </button>
    {/each}
    <span class="meta">{tab === 'activity' ? '30 days' : 'collected'}</span>
  </div>
  <div id="signal-panel" role="tabpanel" aria-labelledby={`signal-tab-${tab}`} data-tab-panel={tab}>
    {#if tab === 'activity'}
      <ActivitySignal activity={overview.activity} {momentum} {now} />
    {:else if tab === 'reach'}
      <ReachSignal reach={overview.reach} {now} chart={reachChart} />
    {:else}
      <CodebaseSignal codebase={overview.codebase} {now} chart={codebaseChart} />
    {/if}
  </div>
</section>

<style>
  .signals {
    padding: var(--space-3) var(--space-4) var(--space-4);
    border-top: var(--rule) solid var(--border-subtle);
  }

  .tabs {
    display: flex;
    align-items: flex-end;
    gap: var(--space-4);
    border-bottom: var(--rule) solid var(--border-default);
  }

  .tabs button {
    padding: 0 0 var(--space-2);
    border: 0;
    border-bottom: var(--rule-strong) solid transparent;
    background: none;
    color: var(--text-secondary);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    cursor: pointer;
  }

  .tabs button[aria-selected='true'] {
    color: var(--text-primary);
    border-bottom-color: var(--text-primary);
  }

  .meta {
    margin-left: auto;
    padding-bottom: var(--space-2);
    color: var(--text-secondary);
    font-size: var(--text-2xs);
  }
</style>
