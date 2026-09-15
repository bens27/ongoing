<script lang="ts">
  import { tick } from 'svelte';
  import Icon from '../Icon.svelte';
  import type { IconName } from '../icons';

  /**
   * The infrequent actions, grouped behind one button so the overview leads with the project
   * rather than a toolbar — without dropping any of them. A real menu: `aria-haspopup`, roving
   * focus with the arrow keys, Home/End, Escape back to the trigger, and a click outside closes
   * it. Every item names its CLI equivalent as a hint, the way the palette does.
   */
  export interface MenuItem {
    id: string;
    label: string;
    icon: IconName;
    hint?: string;
    run: () => void;
  }

  let { items, label = 'More actions' }: { items: MenuItem[]; label?: string } = $props();

  let open = $state(false);
  let trigger = $state<HTMLButtonElement | null>(null);
  let list = $state<HTMLDivElement | null>(null);
  let root = $state<HTMLDivElement | null>(null);

  function buttons(): HTMLButtonElement[] {
    return [...(list?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
  }

  async function show(focusIndex = 0) {
    open = true;
    await tick();
    const all = buttons();
    all.at(focusIndex)?.focus();
  }

  function close(restore = true) {
    if (!open) return;
    open = false;
    if (restore) trigger?.focus();
  }

  function onTriggerKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      void show(event.key === 'ArrowDown' ? 0 : -1);
    }
  }

  function onMenuKeydown(event: KeyboardEvent) {
    const all = buttons();
    const index = all.indexOf(document.activeElement as HTMLButtonElement);
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        all[(index + 1) % all.length]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        all[(index - 1 + all.length) % all.length]?.focus();
        break;
      case 'Home':
        event.preventDefault();
        all[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        all.at(-1)?.focus();
        break;
      case 'Tab':
        close(false);
        break;
    }
  }

  function onWindowPointerdown(event: PointerEvent) {
    if (open && root && !root.contains(event.target as Node)) close(false);
  }

  function run(item: MenuItem) {
    close();
    item.run();
  }
</script>

<svelte:window onpointerdown={onWindowPointerdown} />

<div class="menu-root" bind:this={root}>
  <button
    class="button button-ghost"
    type="button"
    aria-label={label}
    aria-haspopup="menu"
    aria-expanded={open}
    bind:this={trigger}
    onclick={() => (open ? close() : void show())}
    onkeydown={onTriggerKeydown}
  >
    <Icon name="more-horizontal" size={13} />
  </button>
  {#if open}
    <div
      class="menu"
      role="menu"
      tabindex="-1"
      aria-label={label}
      bind:this={list}
      onkeydown={onMenuKeydown}
    >
      {#each items as item (item.id)}
        <button class="item" type="button" role="menuitem" tabindex="-1" onclick={() => run(item)}>
          <Icon name={item.icon} size={12} />
          <span class="item-label">{item.label}</span>
          {#if item.hint}<span class="hint u-mono">{item.hint}</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .menu-root {
    position: relative;
  }

  .menu {
    position: absolute;
    top: calc(100% + var(--space-1));
    right: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    min-width: var(--menu-width);
    padding: var(--space-1);
    background: var(--bg-raised);
    border: var(--rule) solid var(--border-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-overlay);
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-1) var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-primary);
    font-size: var(--text-xs);
    text-align: left;
    cursor: pointer;
  }

  .item:hover,
  .item:focus-visible {
    background: var(--bg-hover);
    outline: none;
  }

  .item-label {
    flex: 1;
    white-space: nowrap;
  }

  .hint {
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
    white-space: nowrap;
  }
</style>
