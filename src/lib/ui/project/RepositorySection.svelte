<script lang="ts">
  import Badge from '../Badge.svelte';
  import { fullDate, relativeAge, shortDate, wholeNumber } from '../format';
  import Icon from '../Icon.svelte';
  import type { RepositorySummary } from '../overview';
  import Disclosure from './Disclosure.svelte';

  /** Repository and release: CI, branch, and divergence in one line; the checkout behind it. */
  let {
    repository,
    now,
    open = $bindable(false)
  }: { repository: RepositorySummary; now: number; open?: boolean } = $props();

  let githubUnavailable = $derived(
    repository.githubAvailability && repository.githubAvailability !== 'available'
  );
  let ci = $derived.by(() => {
    if (githubUnavailable || repository.github.state === 'never')
      return { label: 'CI not collected', tone: 'neutral' as const };
    switch (repository.ciState) {
      case 'success':
        return { label: 'CI passing', tone: 'ok' as const };
      case 'failure':
        return { label: 'CI failing', tone: 'error' as const };
      case 'pending':
        return { label: 'CI pending', tone: 'info' as const };
      default:
        return { label: 'CI unknown', tone: 'neutral' as const };
    }
  });
  let divergence = $derived.by(() => {
    if (repository.git.state === 'never') return null;
    const parts: string[] = [];
    if (repository.ahead) parts.push(`${wholeNumber(repository.ahead)} ahead`);
    if (repository.behind) parts.push(`${wholeNumber(repository.behind)} behind`);
    if (repository.dirtyFiles) parts.push(`${wholeNumber(repository.dirtyFiles)} changed`);
    return parts.length ? parts.join(' · ') : 'clean checkout';
  });
</script>

<Disclosure title="Repository & release" icon="git-branch" bind:open>
  {#snippet summary()}
    <Badge tone={ci.tone} dot>{ci.label}</Badge>
    {#if repository.branch}<span class="u-mono">{repository.branch}</span>{/if}
    {#if divergence}<span>·</span><span>{divergence}</span>{/if}
    {#if repository.isMissing}<Badge tone="error" dot>missing from disk</Badge>{/if}
    {#if repository.archived}<Badge tone="neutral">archived on GitHub</Badge>{/if}
  {/snippet}

  {#if repository.path}
    <p><span class="u-mono">{repository.path}</span></p>
  {:else if repository.remoteSource}
    <p>
      No local checkout. Found by <span class="u-mono"
        >{repository.remoteSource.provider} · {repository.remoteSource.locator}</span
      >.
    </p>
  {:else}
    <p>No local checkout and no remote source recorded.</p>
  {/if}

  {#if repository.git.state !== 'never'}
    <p>
      {wholeNumber(repository.dirtyFiles)} changed files · {wholeNumber(repository.ahead)} ahead ·
      {wholeNumber(repository.behind)} behind
      {#if repository.headSha}
        · head <span class="u-mono">{repository.headSha.slice(0, 7)}</span>
      {/if}
    </p>
    <dl class="split">
      <div>
        <dd class="u-mono">{repository.latestTag ?? '—'}</dd>
        <dt>latest local tag</dt>
      </div>
      <div>
        <dd class="u-mono">{wholeNumber(repository.commitsSinceLatestTag)}</dd>
        <dt>commits since tag</dt>
      </div>
      <div>
        <dd class="u-mono">{wholeNumber(repository.releaseDownloads)}</dd>
        <dt>release downloads</dt>
      </div>
    </dl>
  {/if}

  {#if repository.latestRelease}
    <p>
      Latest GitHub release: <span class="u-mono">{repository.latestRelease.tag ?? '—'}</span>
      {#if repository.latestRelease.at}· {shortDate(repository.latestRelease.at)}{/if}
    </p>
  {:else if !githubUnavailable && repository.github.state !== 'never'}
    <p>No GitHub release collected.</p>
  {/if}

  {#if repository.checksUrl && !githubUnavailable}
    <div class="links">
      <a href={repository.checksUrl} target="_blank" rel="noreferrer"
        >Checks <Icon name="external-link" size={10} /></a
      >
    </div>
  {/if}

  <p class="meta">
    {#if repository.git.state === 'never'}
      Git never observed
    {:else}
      <span title={fullDate(repository.git.observedAt)}
        >Git observed {relativeAge(repository.git.observedAt, now)} ago</span
      >
      {#if repository.git.state === 'stale'}<Badge tone="warn">stale</Badge>{/if}
    {/if}
    <br />
    {#if githubUnavailable}
      GitHub {repository.githubAvailability?.replace('_', ' ')}
    {:else if repository.github.state === 'never'}
      GitHub never observed
    {:else}
      <span title={fullDate(repository.github.observedAt)}
        >CI observed {relativeAge(repository.github.observedAt, now)} ago</span
      >
      {#if repository.github.state === 'stale'}<Badge tone="warn">stale</Badge>{/if}
    {/if}
  </p>
</Disclosure>

<style>
  p {
    margin: var(--space-2) 0 0;
    overflow-wrap: anywhere;
  }

  p:first-child {
    margin-top: 0;
  }

  .split {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
    margin: var(--space-3) 0 0;
  }

  .split dd {
    margin: 0;
    color: var(--text-primary);
    font-size: var(--text-lg);
    font-weight: var(--weight-medium);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .split dt {
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

  .meta {
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
    line-height: 1.8;
  }
</style>
