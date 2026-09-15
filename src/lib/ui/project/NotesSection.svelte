<script lang="ts">
  import { describeMissing } from '$lib/domain/completeness';
  import type { EntryView } from '$lib/domain/entry-view';
  import type { FieldDefinition } from '$lib/domain/fields';
  import type { Catalog } from '../catalog.svelte';
  import FieldEditor from '../FieldEditor.svelte';
  import { formatValue } from '../format';
  import type { NotesSummary, OverviewPriority } from '../overview';
  import Disclosure from './Disclosure.svelte';

  /**
   * Notes and decisions: the note on the line, every editable decision field behind it — intent,
   * next action, excitement, review date, tags, and any field someone registered. Edits go
   * through the shared catalog like every other surface; one field is edited at a time, and the
   * open editor is bound to the owner so it survives a data refresh.
   */
  let {
    entry,
    notes,
    priority,
    catalog,
    now,
    open = $bindable(false),
    editing = $bindable<string | null>(null)
  }: {
    entry: EntryView;
    notes: NotesSummary;
    priority: OverviewPriority;
    catalog: Catalog;
    now: number;
    open?: boolean;
    editing?: string | null;
  } = $props();

  function save(field: FieldDefinition, value: Parameters<Catalog['setField']>[2]) {
    editing = null;
    void catalog.setField(entry, field.key, value);
  }
</script>

<Disclosure title="Notes & decisions" icon="pencil" bind:open>
  {#snippet summary()}
    <span class="note" class:empty={!notes.note}>{notes.note || 'No note'}</span>
  {/snippet}

  <dl class="kv">
    {#each notes.fields as field (field.key)}
      <dt title={field.description ?? field.key}>{field.label}</dt>
      <dd>
        {#if editing === field.key}
          <FieldEditor
            definition={field}
            value={entry.fields[field.key]}
            ariaLabel={`${field.label} for ${entry.name}`}
            onsave={(value) => save(field, value)}
            oncancel={() => (editing = null)}
          />
        {:else}
          <button
            type="button"
            class="edit"
            class:pending={catalog.pending[entry.id]?.includes(field.key)}
            aria-label={`Edit ${field.label} for ${entry.name}`}
            onclick={() => (editing = field.key)}
          >
            {formatValue(field, entry.fields[field.key], now)}
          </button>
        {/if}
      </dd>
    {/each}
  </dl>
  <p class="meta">
    Catalog completeness {priority.completeness.complete}%{#if priority.completeness.missing.length}
      · missing {describeMissing(catalog.registry, priority.completeness.missing)}{/if}
  </p>
</Disclosure>

<style>
  .note {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .note.empty {
    color: var(--text-tertiary);
  }

  .kv {
    display: grid;
    grid-template-columns: minmax(var(--kv-label-min), var(--kv-label-max)) 1fr;
    gap: var(--space-1) var(--space-2);
    margin: 0;
  }

  dt {
    color: var(--text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  dd {
    margin: 0;
    min-width: 0;
    color: var(--text-primary);
  }

  .edit {
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: text;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .edit:hover {
    color: var(--accent);
  }

  .edit.pending {
    color: var(--text-tertiary);
  }

  .meta {
    margin: var(--space-3) 0 0;
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
  }
</style>
