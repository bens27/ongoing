<script lang="ts">
  import Icon from '../Icon.svelte';
  import type { IconName } from '../icons';

  /**
   * A collapsed section that still says something useful. The summary line is the section's
   * one-line answer; the body is the evidence behind it. Native `<details>`, so it is a single
   * Tab stop that Enter and Space toggle, and `open` is bindable so the owner can keep it stable
   * across data refreshes.
   */
  let {
    title,
    icon,
    open = $bindable(false),
    summary,
    children
  }: {
    title: string;
    icon: IconName;
    open?: boolean;
    summary?: import('svelte').Snippet;
    children: import('svelte').Snippet;
  } = $props();
</script>

<details class="disclosure" bind:open data-section={title}>
  <summary>
    <span class="line">
      <Icon name={icon} size={13} />
      <span class="title">{title}</span>
      <Icon name="chevron-right" size={13} class="chevron" />
    </span>
    {#if summary}<span class="sub">{@render summary()}</span>{/if}
  </summary>
  <div class="body">{@render children()}</div>
</details>

<style>
  .disclosure {
    border-top: var(--rule) solid var(--border-subtle);
  }

  summary {
    list-style: none;
    padding: var(--space-3) var(--space-4);
    cursor: pointer;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary:hover {
    background: var(--bg-hover);
  }

  .line {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
  }

  .line :global(.chevron) {
    margin-left: auto;
    color: var(--text-tertiary);
    transition: transform var(--duration-fast);
  }

  .disclosure[open] .line :global(.chevron) {
    transform: rotate(90deg);
  }

  .sub {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-1);
    color: var(--text-secondary);
    font-size: var(--text-xs);
  }

  .body {
    padding: 0 var(--space-4) var(--space-4);
    color: var(--text-secondary);
    font-size: var(--text-xs);
    line-height: var(--leading-normal);
  }
</style>
