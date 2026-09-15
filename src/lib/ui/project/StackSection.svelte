<script lang="ts">
  import Badge from '../Badge.svelte';
  import { fullDate, relativeAge } from '../format';
  import Icon from '../Icon.svelte';
  import type { StackSummary } from '../overview';
  import Disclosure from './Disclosure.svelte';
  import { ringTone } from '../views';

  /** The stack: technology names and a count on one line; versions, rings, and evidence behind it. */
  let {
    stack,
    now,
    open = $bindable(false)
  }: { stack: StackSummary; now: number; open?: boolean } = $props();

  function toolchainStatus(status: string): {
    label: string;
    tone: 'ok' | 'warn' | 'error' | 'neutral';
  } {
    switch (status) {
      case 'current':
        return { label: 'current', tone: 'ok' };
      case 'behind':
        return { label: 'behind', tone: 'warn' };
      case 'eol':
        return { label: 'end of life', tone: 'error' };
      default:
        return { label: status, tone: 'neutral' };
    }
  }
</script>

<Disclosure title="Stack" icon="package" bind:open>
  {#snippet summary()}
    {#if stack.names.length}
      <span class="names">{stack.names.join(' · ')}</span>
      <span class="count"
        >{stack.names.length} technolog{stack.names.length === 1 ? 'y' : 'ies'}</span
      >
    {:else}
      <span>No technologies detected or declared</span>
    {/if}
  {/snippet}

  {#if stack.technologies.length}
    <ul class="tech">
      {#each stack.technologies as technology (technology.slug)}
        <li>
          <div class="tech-line">
            <a href={`/t/${technology.slug}`}>
              <Icon name="package" size={11} />
              <span class="tech-name">{technology.name}</span>
              {#if technology.version}<span class="u-mono version">{technology.version}</span>{/if}
            </a>
            <Badge tone={ringTone(technology.ring)}>{technology.ring ?? 'unrated'}</Badge>
          </div>
          <span class="meta">
            {technology.evidence}{#if technology.sourceFile}
              · <span class="u-mono">{technology.sourceFile}</span>{/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}

  {#if stack.toolchains.length}
    <ul class="toolchains">
      {#each stack.toolchains as toolchain (`${toolchain.toolchain}:${toolchain.sourceFile}`)}
        {@const status = toolchainStatus(toolchain.status)}
        <li>
          <span class="u-mono">{toolchain.toolchain} {toolchain.declared ?? 'not pinned'}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
          {#if toolchain.cyclesBehind}
            <span class="meta">{toolchain.cyclesBehind} cycles behind {toolchain.latestCycle}</span>
          {:else if toolchain.eolFrom}
            <span class="meta">end of life {toolchain.eolFrom}</span>
          {/if}
          {#if toolchain.sourceFile}<span class="meta u-mono">{toolchain.sourceFile}</span>{/if}
        </li>
      {/each}
    </ul>
    <p class="meta observed">
      {#if stack.stack.state === 'never'}
        Toolchains never observed
      {:else}
        <span title={fullDate(stack.stack.observedAt)}
          >Toolchains observed {relativeAge(stack.stack.observedAt, now)} ago</span
        >
        {#if stack.stack.state === 'stale'}<Badge tone="warn">stale</Badge>{/if}
      {/if}
    </p>
  {:else if !stack.technologies.length}
    <p>Nothing declared in a manifest, and no `uses` edge recorded. `ongoing tech use` adds one.</p>
  {/if}
</Disclosure>

<style>
  .names {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
    white-space: nowrap;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tech li {
    display: flex;
    flex-direction: column;
    gap: var(--space-half);
    padding: var(--space-2) 0;
    border-bottom: var(--rule) solid var(--border-subtle);
  }

  .tech li:last-child {
    border-bottom: 0;
  }

  .tech-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .tech-line a {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
    color: var(--text-primary);
  }

  .tech-line a:hover {
    color: var(--accent);
  }

  .version {
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
  }

  .toolchains {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-top: var(--space-3);
  }

  .toolchains li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .meta {
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
  }

  p {
    margin: 0;
  }

  .observed {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
</style>
