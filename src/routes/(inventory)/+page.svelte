<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { AttributeValue } from '$lib/domain/entry';
  import type { EntryView } from '$lib/domain/entry-view';
  import {
    filterRows,
    QueryError,
    sortRows,
    validateColumns,
    validateQuery,
    validateSort
  } from '$lib/domain/query';
  import { TECHNOLOGY_KIND } from '$lib/domain/technology';
  import Badge from '$lib/ui/Badge.svelte';
  import { getCatalogContext, getShellContext } from '$lib/ui/context';
  import EntryFacts from '$lib/ui/EntryFacts.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import Panel from '$lib/ui/Panel.svelte';
  import QueryHelp from '$lib/ui/QueryHelp.svelte';
  import ProjectPanel from '$lib/ui/project/ProjectPanel.svelte';
  import {
    inventoryHref,
    readInventoryState,
    resolveColumns,
    toggleSort,
    type InventoryPatch
  } from '$lib/ui/query-state';
  import { recallListScroll, rememberListScroll } from '$lib/ui/scroll-memory';
  import Table from '$lib/ui/Table.svelte';
  import { attentionTone, VIEW_LABELS } from '$lib/ui/views';
  import { roleField } from '$lib/ui/rich-fields';

  /**
   * The inventory. Filtering, sorting, and column choice run locally over the rows the layout
   * loaded, using the same pure functions `/api/entries` runs on the server, and the URL carries
   * the query so a link is an `ongoing list` command (ADR 0006, ADR 0008).
   */
  const catalog = getCatalogContext();
  const shell = getShellContext();

  let inventory = $derived(readInventoryState(page.url.searchParams, catalog.views));
  let filterDraft = $state('');
  let queryHelpOpen = $state(false);
  let filterFocused = $state(false);
  let menu = $state<'sort' | 'columns' | null>(null);
  let activeIndex = $state(0);
  let editing = $state<{ id: string; key: string } | null>(null);
  let filterInput = $state<HTMLInputElement | null>(null);

  let columns = $derived(resolveColumns(inventory.columns, catalog.registry, inventory.kind));
  let identityField = $derived(
    roleField(catalog.registry, inventory.kind ?? 'project', 'identity')
  );

  let queryError = $derived.by(() => {
    try {
      validateQuery(inventory.parsed, catalog.registry, inventory.kind ?? undefined);
      validateSort(inventory.sort, catalog.registry, inventory.kind ?? undefined);
      validateColumns(inventory.columns, catalog.registry, inventory.kind ?? undefined);
      return null;
    } catch (error) {
      return error instanceof QueryError ? error.message : String(error);
    }
  });

  let rows = $derived.by(() => {
    if (queryError) return [] as EntryView[];
    return sortRows(
      filterRows(catalog.entries, inventory.parsed, catalog.registry),
      inventory.sort,
      catalog.registry
    );
  });

  let active = $derived(rows[Math.min(activeIndex, Math.max(0, rows.length - 1))] ?? null);
  let openEntry = $derived.by(() => {
    if (!inventory.entry) return null;
    const [kind, slug] = inventory.entry.split('/');
    return catalog.bySlug(kind, slug) ?? null;
  });

  $effect(() => {
    catalog.focused = active;
  });

  // `activeIndex` normally moves with j/k and stays in step with the open panel because those
  // paths already set both together. Loading a URL with `?entry=` already in it — a direct link,
  // or the fact sheet's `?from=` return — skips that: `activeIndex` starts at its default 0,
  // which would leave `active` (and so `catalog.focused`, and every list-scoped shortcut and
  // palette command) pointed at the first row while a different project's panel is actually open.
  // Bring it into step whenever the open entry and the active row disagree.
  $effect(() => {
    if (!openEntry) return;
    const index = rows.findIndex((row) => row.id === openEntry.id);
    if (index !== -1 && index !== activeIndex) activeIndex = index;
  });

  $effect(() => {
    if (!filterFocused) filterDraft = inventory.query;
  });

  function navigate(patch: InventoryPatch, replaceState = true) {
    void goto(inventoryHref(inventory, patch), { keepFocus: true, noScroll: true, replaceState });
  }

  function entryToken(entry: EntryView): string {
    return `${entry.kind}/${entry.slug}`;
  }

  function openPanel(entry: EntryView | null) {
    navigate({ entry: entry ? entryToken(entry) : null });
  }

  function factSheetHref(entry: EntryView): string {
    const path = `/${entry.kind === TECHNOLOGY_KIND ? 't' : 'p'}/${entry.slug}`;
    const from = inventoryHref(inventory, { entry: entryToken(entry) });
    return `${path}?from=${encodeURIComponent(from)}`;
  }

  // The list's own scroll position, remembered under the exact URL it belongs to — so a fact
  // sheet's "back to inventory" link, which lands on this same URL, restores it, while an
  // unrelated visit to `/` starts at the top like normal browsing.
  let tableScroll = $state<HTMLDivElement | null>(null);
  let currentHref = $derived(`${page.url.pathname}${page.url.search}`);

  $effect(() => {
    const container = tableScroll;
    const href = currentHref;
    if (!container) return;
    const saved = recallListScroll(href);
    if (saved !== null) container.scrollTop = saved;
    // Saved live, on scroll, rather than only at cleanup: a route change tears the container down
    // before a cleanup could reliably still read its scrollTop.
    const onscroll = () => rememberListScroll(href, container.scrollTop);
    container.addEventListener('scroll', onscroll, { passive: true });
    return () => container.removeEventListener('scroll', onscroll);
  });

  function saveCurrentView() {
    const name = window.prompt('Save this query as a view named…', inventory.saved ?? '');
    if (!name?.trim()) return;
    void catalog.saveView({
      name: name.trim(),
      kind: inventory.kind,
      query: inventory.query,
      columns: inventory.columns
    });
  }

  function firstEditable(): string | null {
    return (
      columns.find(
        (column) => column.editable && column.storage !== 'projected' && column.key !== 'name'
      )?.key ?? null
    );
  }

  function typingInto(target: EventTarget | null): boolean {
    const node = target as HTMLElement | null;
    return Boolean(
      node instanceof HTMLInputElement ||
      node instanceof HTMLTextAreaElement ||
      node instanceof HTMLSelectElement ||
      node?.isContentEditable
    );
  }

  function onkeydown(event: KeyboardEvent) {
    if (queryHelpOpen) return;
    if (
      event.key === '?' &&
      !typingInto(event.target) &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      event.preventDefault();
      queryHelpOpen = true;
      return;
    }
    if (event.key === 'Escape') {
      if (editing) editing = null;
      else if (menu) menu = null;
      else if (inventory.entry) openPanel(null);
      else if (typingInto(event.target)) (event.target as HTMLElement).blur();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (typingInto(event.target)) return;
    // Focus inside the detail panel means its own controls — menu, tabs, disclosures, editors —
    // own the keyboard; the list shortcuts resume the moment focus leaves it.
    if (event.target instanceof Element && event.target.closest('[data-panel]')) return;

    switch (event.key) {
      case 'j':
      case 'ArrowDown':
        event.preventDefault();
        activeIndex = Math.min(activeIndex + 1, rows.length - 1);
        if (inventory.entry && active) openPanel(rows[activeIndex] ?? null);
        break;
      case 'k':
      case 'ArrowUp':
        event.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        if (inventory.entry && active) openPanel(rows[activeIndex] ?? null);
        break;
      case 'Enter':
        event.preventDefault();
        openPanel(active);
        break;
      case '/':
        event.preventDefault();
        filterInput?.focus();
        filterInput?.select();
        break;
      case ',':
        event.preventDefault();
        menu = menu === 'sort' ? null : 'sort';
        break;
      case 'c':
        event.preventDefault();
        menu = menu === 'columns' ? null : 'columns';
        break;
      case 'e':
        if (!active) break;
        event.preventDefault();
        {
          const key = firstEditable();
          if (key) editing = { id: active.id, key };
        }
        break;
      case 'f':
        if (!active) break;
        event.preventDefault();
        void catalog.setField(active, 'is_favorite', !active.isFavorite);
        break;
      case 'x':
        if (!active) break;
        event.preventDefault();
        void catalog.setField(active, 'is_hidden', !active.isHidden);
        break;
    }
  }

  function submitFilter(event: SubmitEvent) {
    event.preventDefault();
    filterFocused = false;
    filterInput?.blur();
    navigate({ query: filterDraft, entry: null }, false);
  }

  function save(row: EntryView, key: string, value: AttributeValue) {
    editing = null;
    void catalog.setField(row, key, value);
  }

  let sortableFields = $derived(
    catalog.registry.forKind(inventory.kind ?? 'project').filter((field) => field.sortable)
  );
  let choosableFields = $derived(catalog.registry.forKind(inventory.kind ?? 'project'));
</script>

<svelte:window {onkeydown} />

<header class="bar">
  <form class="filter" onsubmit={submitFilter}>
    <Icon name="search" size={13} />
    <input
      type="search"
      class="filter-input"
      aria-label="Filter inventory"
      placeholder="intent:invest github.stars>=100 -tag:archived"
      spellcheck="false"
      autocomplete="off"
      bind:this={filterInput}
      bind:value={filterDraft}
      onfocus={() => (filterFocused = true)}
      onblur={() => (filterFocused = false)}
    />
    <kbd class="kbd">/</kbd>
    <button
      class="button button-ghost"
      type="button"
      aria-label="Query language help"
      title="Query language help (?)"
      onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
      }}
      onclick={() => (queryHelpOpen = true)}>?</button
    >
  </form>

  <div class="controls">
    {#if inventory.saved}
      <Badge tone="accent">{VIEW_LABELS[inventory.saved] ?? inventory.saved}</Badge>
    {/if}
    <button
      class="button"
      type="button"
      aria-expanded={menu === 'sort'}
      onclick={() => (menu = menu === 'sort' ? null : 'sort')}
    >
      <Icon name="sort" size={12} /> sort <kbd class="kbd">,</kbd>
    </button>
    <button
      class="button"
      type="button"
      aria-expanded={menu === 'columns'}
      onclick={() => (menu = menu === 'columns' ? null : 'columns')}
    >
      <Icon name="columns" size={12} /> columns <kbd class="kbd">c</kbd>
    </button>
    <button class="button" type="button" onclick={saveCurrentView}>
      <Icon name="plus" size={12} /> save view
    </button>
    <span class="count u-mono">{rows.length} of {catalog.entries.length}</span>
  </div>
</header>

<QueryHelp
  bind:open={queryHelpOpen}
  registry={catalog.registry}
  ontry={(query) => {
    filterDraft = query;
    navigate({ query, entry: null }, false);
  }}
/>

{#if menu}
  <div class="menu" role="group" aria-label={menu === 'sort' ? 'Sort keys' : 'Columns'}>
    {#if menu === 'sort'}
      {#each sortableFields as field (field.key)}
        {@const key = inventory.sort.find((entry) => entry.field === field.key)}
        <button
          class="button"
          type="button"
          aria-pressed={Boolean(key)}
          onclick={() => navigate({ sort: toggleSort(inventory.sort, field.key) })}
        >
          {field.label}
          {#if key}<Icon
              name={key.direction === 'asc' ? 'chevron-up' : 'chevron-down'}
              size={11}
            />{/if}
        </button>
      {/each}
    {:else}
      {#each choosableFields as field (field.key)}
        {@const shown = inventory.columns.includes(field.key)}
        <button
          class="button"
          type="button"
          aria-pressed={shown}
          onclick={() =>
            navigate({
              columns: shown
                ? inventory.columns.filter((column) => column !== field.key)
                : [...inventory.columns, field.key]
            })}
        >
          {#if shown}<Icon name="check" size={11} />{/if}
          {field.label}
        </button>
      {/each}
    {/if}
  </div>
{/if}

<div class="workspace" class:panel-open={Boolean(openEntry)}>
  <main class="list">
    {#if queryError}
      <p class="empty" role="alert">{queryError}</p>
    {:else if rows.length === 0}
      <p class="empty">
        Nothing matches <code class="u-mono">{inventory.query || 'this query'}</code>. Press
        <kbd class="kbd">/</kbd> to widen it.
      </p>
    {:else}
      <Table
        {identityField}
        {columns}
        {rows}
        sort={inventory.sort}
        {activeIndex}
        {editing}
        pending={catalog.pending}
        bind:scrollContainer={tableScroll}
        onactivate={(index) => (activeIndex = index)}
        onopen={(row) => openPanel(row)}
        onedit={(row, key) => (editing = { id: row.id, key })}
        onsave={save}
        oncancel={() => (editing = null)}
        onsort={(key) => navigate({ sort: toggleSort(inventory.sort, key) })}
      />
    {/if}
  </main>

  {#if openEntry && openEntry.kind === 'project'}
    <!-- Keyed by id: disclosure state and open editors belong to one project, and a refresh of
         the same project's row must not reset them. -->
    {#key openEntry.id}
      <ProjectPanel
        entry={openEntry}
        {catalog}
        factSheetHref={factSheetHref(openEntry)}
        onclose={() => openPanel(null)}
        onopenpalette={shell?.openPalette}
      />
    {/key}
  {:else if openEntry}
    <!-- Other kinds keep the generic, registry-driven fact sheet until they are redesigned. -->
    <Panel
      title={openEntry.name}
      subtitle={openEntry.path ?? `${openEntry.kind}/${openEntry.slug}`}
      onclose={() => openPanel(null)}
    >
      {#snippet actions()}
        <a class="button" href={factSheetHref(openEntry)}>
          <Icon name="external-link" size={12} /> fact sheet
        </a>
      {/snippet}
      <div class="panel-views">
        {#each openEntry.views as view (view)}
          <Badge tone={attentionTone(view)} dot>{VIEW_LABELS[view] ?? view}</Badge>
        {/each}
      </div>
      <EntryFacts entry={openEntry} {catalog} />
    </Panel>
  {/if}
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    height: var(--header-height);
    padding: 0 var(--space-3);
    border-bottom: 1px solid var(--border-strong);
    background: var(--bg-canvas);
  }

  .filter {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
    min-width: 0;
    color: var(--text-tertiary);
  }

  .filter-input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    outline: none;
  }

  .filter-input::placeholder {
    color: var(--text-tertiary);
    opacity: 0.7;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .count {
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
  }

  .menu {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--border-strong);
    background: var(--bg-inset);
  }

  .workspace {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .list {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .empty {
    margin: 0;
    padding: var(--space-8) var(--space-4);
    color: var(--text-tertiary);
    text-align: center;
  }

  .panel-views {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--border-subtle);
  }

  @media (max-width: 640px) {
    .bar {
      flex-wrap: wrap;
      align-content: center;
      height: auto;
      min-height: calc(var(--header-height) * 2);
      padding-block: var(--space-2);
    }

    .filter,
    .controls {
      flex-basis: 100%;
    }

    .controls {
      gap: var(--space-1);
      overflow-x: auto;
    }

    .controls .count {
      margin-left: auto;
    }

    .workspace.panel-open .list {
      display: none;
    }
  }
</style>
