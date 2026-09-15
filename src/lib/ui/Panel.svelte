<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * The right-hand detail panel. It sits inside the grid rather than floating over it, so the list
   * keeps its keyboard focus and `Enter` never takes you off the row you were reading.
   *
   * One shell for every kind. The generic fact sheet fills it with a title and its body; the
   * project overview asks for the `wide` variant, an eyebrow in place of the title (its identity
   * section carries the name), and a footer. The widths are the two panel tokens: `wide` falls
   * back to the default width under the compact breakpoint, and the default never changes.
   */
  let {
    title,
    subtitle,
    eyebrow,
    variant = 'default',
    onclose,
    children,
    actions,
    footer
  }: {
    /** Names the panel for assistive technology (`<title> details`) and, without an eyebrow, heads it. */
    title: string;
    subtitle?: string;
    /** A short label shown instead of the title, for a body that carries its own heading. */
    eyebrow?: string;
    /** `wide` is the project overview's 520px; everything else keeps the 400px default. */
    variant?: 'default' | 'wide';
    onclose?: () => void;
    children: import('svelte').Snippet;
    actions?: import('svelte').Snippet;
    footer?: import('svelte').Snippet;
  } = $props();
</script>

<aside
  class="panel"
  class:wide={variant === 'wide'}
  aria-label={`${title} details`}
  data-panel={variant}
>
  <header class:compact={Boolean(eyebrow)}>
    <div class="identity">
      {#if eyebrow}
        <span class="eyebrow">{eyebrow}</span>
      {:else}
        <h2>{title}</h2>
        {#if subtitle}<p class="u-dim">{subtitle}</p>{/if}
      {/if}
    </div>
    {#if actions}<div class="actions">{@render actions()}</div>{/if}
    {#if onclose}
      <button
        class="button button-ghost"
        type="button"
        aria-label="Close details"
        onclick={onclose}
      >
        <Icon name="x" size={13} />
      </button>
    {/if}
  </header>
  <div class="body">
    {@render children()}
  </div>
  {#if footer}<footer class="foot">{@render footer()}</footer>{/if}
</aside>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    width: var(--panel-width);
    min-width: 0;
    background: var(--bg-surface);
    border-left: var(--rule) solid var(--border-strong);
    overflow: hidden;
  }

  .panel.wide {
    width: var(--panel-width-wide);
  }

  header {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-3);
    border-bottom: var(--rule) solid var(--border-subtle);
  }

  header.compact {
    align-items: center;
    padding: var(--space-2) var(--space-3) var(--space-2) var(--space-4);
  }

  .identity {
    flex: 1;
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--weight-strong);
    line-height: var(--leading-tight);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  p {
    margin: 0;
    font-size: var(--text-2xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .eyebrow {
    color: var(--text-secondary);
    font-size: var(--text-2xs);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .body {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border-top: var(--rule) solid var(--border-default);
    color: var(--text-secondary);
    font-size: var(--text-2xs);
  }

  /* Under the compact breakpoint the wide variant gives up its extra width before the list
     does; the default width is untouched at every size. */
  @media (max-width: 1365px) {
    .panel.wide {
      width: var(--panel-width);
    }
  }

  @media (max-width: 640px) {
    .panel,
    .panel.wide {
      width: 100%;
    }
  }
</style>
