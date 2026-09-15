<script lang="ts">
  import type { EntryView } from '$lib/domain/entry-view';
  import Badge from '../Badge.svelte';
  import type { Catalog } from '../catalog.svelte';
  import FieldEditor from '../FieldEditor.svelte';
  import Icon from '../Icon.svelte';
  import type { IdentitySummary } from '../overview';
  import { artifactHash } from '../rich-fields';

  /**
   * What this project is: a compact mark, the name, its one-line purpose, the intent, where the
   * source lives, and the links worth one click. Slug, path, timestamps, and completeness live
   * in the inspector and the repository section; they are supporting facts, not identity.
   */
  let {
    entry,
    identity,
    catalog,
    renaming = $bindable(false),
    oncopypath,
    headingLevel = 2
  }: {
    entry: EntryView;
    identity: IdentitySummary;
    catalog: Catalog;
    renaming?: boolean;
    oncopypath?: () => void;
    /** The panel nests inside the page's own heading (2); the fact sheet is the page (1). */
    headingLevel?: 1 | 2;
  } = $props();

  let nameField = $derived(catalog.registry.get('name')!);
  let headingTag = $derived(`h${headingLevel}` as const);
  let poster = $derived(
    identity.logoField ? artifactHash(entry, identity.logoField, 'poster') : null
  );
  let visibilityLabel = $derived(
    identity.visibility
      ? `${identity.visibility} repository`
      : identity.remoteSource
        ? 'remote'
        : null
  );
</script>

<header class="identity">
  <div class="row">
    <div class="mark" aria-hidden="true">
      {#if poster}
        <img src={`/api/artifacts/${poster}`} alt="" loading="lazy" />
      {:else}
        <Icon name="folder" size={22} />
      {/if}
    </div>
    <div class="heading">
      {#if renaming}
        <FieldEditor
          definition={nameField}
          value={entry.name}
          ariaLabel={`Name for ${entry.name}`}
          onsave={(value) => {
            renaming = false;
            void catalog.setField(entry, 'name', value);
          }}
          oncancel={() => (renaming = false)}
        />
      {:else}
        <svelte:element this={headingTag} class="name">
          {identity.name}
          {#if identity.isFavorite}<span class="star" title="Favorite"
              ><Icon name="star" size={13} /><span class="sr-only">favorite</span></span
            >{/if}
        </svelte:element>
      {/if}
      <div class="badges">
        {#if identity.intent}
          <Badge tone="info">intent · {identity.intent}</Badge>
        {:else}
          <Badge tone="neutral">intent unset</Badge>
        {/if}
        {#if visibilityLabel}<span class="meta">{visibilityLabel}</span>{/if}
        {#if identity.isHidden}<Badge tone="neutral" dot>hidden</Badge>{/if}
        {#if identity.isMissing}<Badge tone="error" dot>missing from disk</Badge>{/if}
      </div>
    </div>
  </div>
  <p class="purpose" class:empty={!identity.purpose}>
    {identity.purpose || 'No note yet — the note is this project’s one-line purpose.'}
  </p>
  <div class="links">
    {#if identity.repositoryUrl}
      <a href={identity.repositoryUrl} target="_blank" rel="noreferrer">
        <Icon name="github" size={12} /> Repository <Icon name="external-link" size={10} />
      </a>
    {/if}
    {#if identity.websiteUrl}
      <a href={identity.websiteUrl} target="_blank" rel="noreferrer">
        <Icon name="globe" size={12} /> Website <Icon name="external-link" size={10} />
      </a>
    {/if}
    {#if identity.path}
      <button class="link" type="button" onclick={oncopypath} title={identity.path}>
        <Icon name="copy" size={12} /> Copy path
      </button>
    {:else if identity.remoteSource}
      <span
        class="meta u-mono"
        title={`${identity.remoteSource.provider}:${identity.remoteSource.locator}`}
      >
        {identity.remoteSource.provider} · {identity.remoteSource.locator}
      </span>
    {/if}
  </div>
</header>

<style>
  .identity {
    padding: var(--space-4) var(--space-4) var(--space-3);
  }

  .row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .mark {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: var(--identity-mark-size);
    height: var(--identity-mark-size);
    background: var(--bg-inset);
    border: var(--rule) solid var(--border-default);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    overflow: hidden;
  }

  .mark img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .heading {
    flex: 1;
    min-width: 0;
  }

  .name {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--weight-strong);
    letter-spacing: var(--tracking-tight);
    line-height: var(--leading-tight);
    overflow-wrap: anywhere;
  }

  .star {
    display: inline-flex;
    color: var(--accent);
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .meta {
    color: var(--text-secondary);
    font-size: var(--text-2xs);
  }

  .purpose {
    margin: var(--space-2) 0 0;
    color: var(--text-secondary);
    font-size: var(--text-xs);
    line-height: var(--leading-normal);
  }

  .purpose.empty {
    color: var(--text-tertiary);
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
    margin-top: var(--space-2);
    font-size: var(--text-xs);
  }

  .links a,
  .link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0;
    border: 0;
    background: none;
    color: var(--text-secondary);
    font: inherit;
    cursor: pointer;
  }

  .links a:hover,
  .link:hover {
    color: var(--text-primary);
  }
</style>
