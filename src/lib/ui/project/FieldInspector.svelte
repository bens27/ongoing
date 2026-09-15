<script lang="ts">
  import { tick } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import type { EntryView } from '$lib/domain/entry-view';
  import type { FieldDefinition } from '$lib/domain/fields';
  import type { Catalog } from '../catalog.svelte';
  import FieldEditor from '../FieldEditor.svelte';
  import { formatValue, fullDate, relativeAge } from '../format';
  import Icon from '../Icon.svelte';
  import { filterInspectorRows, inspectorRows, type ProjectOverview } from '../overview';
  import RichFieldPreview from '../RichFieldPreview.svelte';
  import { providerLabel } from '../views';

  /**
   * All fields and sources: the searchable key/value view the overview keeps off its face. It is
   * driven by the registry, so every field for the kind is here — custom ones, empty ones,
   * provider projections — with its label, description, owner, and the editor its type asks for.
   * Rich values open the existing viewer; structured values fall back to JSON; sources, collection
   * times, collector warnings, and incoming relations are listed below the table.
   *
   * A native modal `<dialog>`: Escape closes it and focus returns to whatever opened it.
   */
  let {
    entry,
    overview,
    catalog,
    now,
    open = $bindable(false),
    query = $bindable('')
  }: {
    entry: EntryView;
    overview: ProjectOverview;
    catalog: Catalog;
    now: number;
    open?: boolean;
    query?: string;
  } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let search = $state<HTMLInputElement | null>(null);
  let editing = $state<string | null>(null);
  const expanded = new SvelteSet<string>();

  let rows = $derived(inspectorRows(entry, catalog.registry));
  let visible = $derived(filterInspectorRows(rows, query));

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      void tick().then(() => search?.focus());
    } else if (!open && dialog.open) dialog.close();
  });

  function save(field: FieldDefinition, value: Parameters<Catalog['setField']>[2]) {
    editing = null;
    void catalog.setField(entry, field.key, value);
  }

  function toggle(key: string) {
    if (expanded.has(key)) expanded.delete(key);
    else expanded.add(key);
  }

  function isStructured(value: unknown): boolean {
    return value !== null && typeof value === 'object';
  }

  function onBackdropClick(event: MouseEvent) {
    if (!dialog || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      open = false;
  }
</script>

<dialog
  class="inspector"
  bind:this={dialog}
  aria-labelledby="inspector-title"
  onclose={() => (open = false)}
  onclick={onBackdropClick}
  onkeydown={(event) => {
    // One Escape closes the inspector — not first the search box's text, and never the panel
    // behind it, whose Escape handler listens on the window.
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    open = false;
  }}
>
  <div class="head">
    <h2 id="inspector-title">All fields &amp; sources · {entry.name}</h2>
    <button
      class="button button-ghost"
      type="button"
      aria-label="Close inspector"
      onclick={() => (open = false)}
    >
      <Icon name="x" size={13} />
    </button>
  </div>
  <div class="body">
    <p class="intro">
      Every registered field for this kind, value or not, from the same registry the CLI reads:
      <code class="u-mono">ongoing get {entry.slug}</code>.
    </p>
    <input
      class="input"
      type="search"
      aria-label="Search fields"
      placeholder="Search fields…"
      bind:this={search}
      bind:value={query}
    />
    <table class="fields">
      <thead>
        <tr><th scope="col">Field</th><th scope="col">Owner</th><th scope="col">Value</th></tr>
      </thead>
      <tbody>
        {#each visible as row (row.field.key)}
          <tr data-field={row.field.key} class:empty={!row.hasValue}>
            <th scope="row">
              <span class="u-mono key">{row.field.key}</span>
              <span class="label">{row.field.label}</span>
              {#if row.field.description}<span class="description">{row.field.description}</span
                >{/if}
            </th>
            <td class="owner">{providerLabel(row.owner)}</td>
            <td class="value">
              {#if editing === row.field.key}
                <FieldEditor
                  definition={row.field}
                  value={row.value}
                  ariaLabel={`${row.field.label} for ${entry.name}`}
                  onsave={(value) => save(row.field, value)}
                  oncancel={() => (editing = null)}
                />
              {:else if row.field.presentation && row.hasValue}
                <RichFieldPreview {entry} field={row.field} interactive />
              {:else if row.hasValue && isStructured(row.value)}
                <button
                  class="structured"
                  type="button"
                  aria-expanded={expanded.has(row.field.key)}
                  onclick={() => toggle(row.field.key)}
                >
                  {Array.isArray(row.value) ? `${row.value.length} values` : 'Structured value'}
                </button>
                {#if expanded.has(row.field.key)}
                  <pre class="u-mono">{JSON.stringify(row.value, null, 2)}</pre>
                {/if}
                {#if row.field.editable}
                  <button
                    class="button button-ghost"
                    type="button"
                    onclick={() => (editing = row.field.key)}
                  >
                    <Icon name="pencil" size={11} /> edit
                  </button>
                {/if}
              {:else if row.field.editable}
                <button
                  type="button"
                  class="edit"
                  aria-label={`Edit ${row.field.label} for ${entry.name}`}
                  onclick={() => (editing = row.field.key)}
                >
                  {formatValue(row.field, row.value, now)}
                </button>
              {:else}
                <span class:dim={!row.hasValue}>{formatValue(row.field, row.value, now)}</span>
              {/if}
            </td>
          </tr>
        {:else}
          <tr><td colspan="3" class="dim">No field matches “{query}”.</td></tr>
        {/each}
      </tbody>
    </table>

    <h3>Sources</h3>
    {#if entry.sources.length}
      <ul class="plain">
        {#each entry.sources as source (source.provider + source.locator)}
          <li>
            <span class="u-mono">{source.provider} · {source.locator}</span>
            <span class="dim">
              first seen {relativeAge(source.firstSeenAt, now)} ago · last seen {relativeAge(
                source.lastSeenAt,
                now
              )} ago{#if source.missingSince}
                · missing since {fullDate(source.missingSince)}{/if}
            </span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="dim">No source recorded; this entry was created by hand.</p>
    {/if}

    <h3>Collection times</h3>
    <ul class="plain">
      {#each overview.observed as item (item.collector)}
        <li>
          <span class="u-mono">{item.collector}</span>
          <span class="dim" title={item.at ? fullDate(item.at) : undefined}>
            {item.at ? `${relativeAge(item.at, now)} ago` : 'not collected'}
          </span>
        </li>
      {/each}
      <li>
        <span class="u-mono">catalog</span>
        <span class="dim" title={fullDate(entry.updatedAt)}
          >updated {relativeAge(entry.updatedAt, now)} ago</span
        >
      </li>
    </ul>

    <h3>Collector warnings</h3>
    {#if entry.errors.length}
      <ul class="plain">
        {#each entry.errors as error (error.collector + error.occurredAt)}
          <li>
            <span><strong>{error.collector}</strong> · {error.message}</span>
            <span class="dim">{relativeAge(error.occurredAt, now)} ago</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="dim">No collector warnings in this snapshot.</p>
    {/if}

    {#if entry.relations.incoming.length}
      <h3>Incoming relations</h3>
      <ul class="plain">
        {#each entry.relations.incoming as relation (relation.id)}
          {#if relation.other}
            <li>
              <a href={`/${relation.other.kind === 'project' ? 'p' : 't'}/${relation.other.slug}`}>
                {relation.other.name}
                {relation.kind} this
              </a>
              <span class="dim">{relation.evidence}</span>
            </li>
          {/if}
        {/each}
      </ul>
    {/if}
  </div>
</dialog>

<style>
  .inspector {
    width: min(var(--dialog-width), calc(100% - var(--space-8)));
    max-height: var(--dialog-max-height);
    padding: 0;
    background: var(--bg-surface);
    color: var(--text-primary);
    border: var(--rule) solid var(--border-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-overlay);
  }

  .inspector::backdrop {
    background: var(--overlay-backdrop);
  }

  .head {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: var(--bg-surface);
    border-bottom: var(--rule) solid var(--border-default);
  }

  h2 {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--weight-medium);
  }

  .body {
    padding: var(--space-4);
    font-size: var(--text-xs);
  }

  .intro {
    margin: 0 0 var(--space-3);
    color: var(--text-secondary);
  }

  .input {
    margin-bottom: var(--space-3);
  }

  .fields {
    width: 100%;
    border-collapse: collapse;
  }

  .fields thead th {
    padding: var(--space-1) var(--space-2);
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-label);
    text-align: left;
    text-transform: uppercase;
    border-bottom: var(--rule) solid var(--border-default);
  }

  .fields td,
  .fields tbody th {
    padding: var(--space-2);
    border-bottom: var(--rule) solid var(--border-subtle);
    vertical-align: top;
    text-align: left;
    font-weight: var(--weight-regular);
    overflow-wrap: anywhere;
  }

  .fields tbody th {
    width: 40%;
  }

  .key {
    display: block;
    color: var(--text-secondary);
    font-size: var(--text-2xs);
  }

  .label {
    display: block;
    color: var(--text-primary);
  }

  .description {
    display: block;
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
  }

  .owner {
    width: 18%;
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
    white-space: nowrap;
  }

  tr.empty .value {
    color: var(--text-tertiary);
  }

  .edit,
  .structured {
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .edit {
    cursor: text;
  }

  .edit:hover,
  .structured:hover {
    color: var(--accent);
  }

  pre {
    margin: var(--space-1) 0 0;
    max-height: var(--pre-max-height);
    overflow: auto;
    color: var(--text-secondary);
    font-size: var(--text-2xs);
    white-space: pre-wrap;
  }

  h3 {
    margin: var(--space-5) 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .plain {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .plain li {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .plain a {
    color: var(--text-primary);
  }

  .plain a:hover {
    color: var(--accent);
  }

  .dim {
    color: var(--text-tertiary);
  }

  p {
    margin: 0;
  }
</style>
