<script lang="ts">
  import type { FieldRegistry } from '$lib/domain/fields';
  import { parseQuery, validateQuery } from '$lib/domain/query';
  import Icon from './Icon.svelte';

  let {
    open = $bindable(false),
    registry,
    ontry
  }: {
    open?: boolean;
    registry: FieldRegistry;
    ontry: (query: string) => void;
  } = $props();
  let dialog = $state<HTMLDialogElement>();
  let fieldSearch = $state('');
  let section = $state<'syntax' | 'fields'>('syntax');
  const examples = [
    [
      'intent:invest -tag:archived',
      'Active investments',
      'Combine filters with a space. Every clause must match.'
    ],
    ['github.stars>=100', 'Find a following', 'Projects with at least 100 GitHub stars.'],
    ['identity.logo:none', 'Missing a logo', 'Find entries where a field has no value.']
  ];
  const syntax = [
    ['sidecar', 'Search names, slugs, paths, and notes. Text matching ignores case.'],
    ['intent:invest', 'Equals a value. For tags and other lists, matches any item.'],
    ['intent:invest,maintain', 'A comma means either value (OR).'],
    ['-tag:archived', 'A leading minus excludes a match. tag!:archived works too.'],
    ['note:~launch', 'Contains text, ignoring case.'],
    ['github.stars>=100', 'Compare with >, >=, <, or <=. Keep the operator next to the value.'],
    ['note:"ship this week"', 'Quote values with spaces or commas. Single quotes work too.'],
    ['note:*', 'Has a value. Use :none or :null for an empty or missing value.'],
    [
      'kind:technology',
      'Switch entry kinds. Lists default to projects and exclude hidden entries.'
    ],
    ['tech:go view:attention', 'Filter by technology or computed view. tag: and view: are aliases.']
  ];
  let fields = $derived(
    registry.fields.filter(
      (field) =>
        (field.filterable || field.presentation) &&
        `${field.key} ${field.label} ${field.description ?? ''}`
          .toLowerCase()
          .includes(fieldSearch.toLowerCase())
    )
  );

  $effect(() => {
    if (open && dialog && !dialog.open) dialog.showModal();
    else if (!open && dialog?.open) dialog.close();
  });

  function tryQuery(query: string) {
    open = false;
    ontry(query);
  }
  function available(query: string): boolean {
    try {
      validateQuery(parseQuery(query), registry);
      return true;
    } catch {
      return false;
    }
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="query-help-title"
  onclose={() => (open = false)}
  onkeydown={(event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      open = false;
    }
  }}
  onclick={(event) => {
    if (event.target !== dialog || !dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      open = false;
  }}
>
  <header>
    <div>
      <h2 id="query-help-title">Query the catalog</h2>
      <p>Start with a word. Add filters to find exactly what needs you.</p>
    </div>
    <button
      class="button button-ghost close"
      aria-label="Close query help"
      onclick={() => (open = false)}><Icon name="x" size={16} /></button
    >
  </header>
  <nav aria-label="Query help sections">
    <button
      class="button button-ghost"
      aria-pressed={section === 'syntax'}
      onclick={() => (section = 'syntax')}>Syntax & examples</button
    >
    <button
      class="button button-ghost"
      aria-pressed={section === 'fields'}
      onclick={() => (section = 'fields')}>Available fields</button
    >
  </nav>
  <div class="body">
    {#if section === 'syntax'}
      <div class="examples">
        {#each examples as [query, title, description] (query)}
          {#if available(query)}
            <button class="example" onclick={() => tryQuery(query)} aria-label={`Try ${query}`}>
              <span class="example-title">{title}<span class="try">Try query ↗</span></span>
              <code>{query}</code><span class="description">{description}</span>
            </button>
          {/if}
        {/each}
      </div>
      <h3>The essentials</h3>
      <dl>
        {#each syntax as [query, description] (query)}<div class="syntax-row">
            <dt><code>{query}</code></dt>
            <dd>{description}</dd>
          </div>{/each}
      </dl>
      <p class="note">
        Spaces mean AND; commas join values within one field. Parentheses and OR between different
        fields aren’t supported. Rich fields, such as logos, support presence checks only.
      </p>
      <details>
        <summary>Sorting & the command line</summary>
        <p>
          Use the sort control to order results. In URLs and the CLI, <code>-github.stars,name</code
          > means stars descending, then name ascending. Empty values sort last.
        </p>
        <pre>ongoing list 'intent:invest -tag:archived' --sort '-github.stars,name'</pre>
        <p>The filter uses the same query language in the browser, CLI, and API.</p>
      </details>
    {:else}
      <input
        class="input"
        type="search"
        aria-label="Search query fields"
        placeholder="Find a field by name or description…"
        bind:value={fieldSearch}
      />
      <p class="note">
        Fields currently registered in your catalog. Use the exact key before an operator; available
        values are shown below.
      </p>
      <div class="fields">
        {#each fields as field (field.key)}
          <div class="field">
            <div>
              <code>{field.key}</code><span class="field-type"
                >{field.filterable ? field.type : 'presence only'}</span
              >
            </div>
            <p>{field.description ?? field.label}</p>
            {#if field.options?.values}<p class="values">{field.options.values.join(' · ')}</p>{/if}
          </div>
        {:else}<p>No fields match “{fieldSearch}”.</p>{/each}
      </div>
    {/if}
  </div>
  <footer>
    <span>Trying a query replaces the current filter.</span><span
      ><kbd class="kbd">esc</kbd> to close</span
    >
  </footer>
</dialog>

<style>
  dialog {
    width: min(var(--dialog-width), calc(100% - var(--space-8)));
    max-height: var(--dialog-max-height);
    padding: 0;
    color: var(--text-primary);
    background: var(--bg-raised);
    border: var(--rule) solid var(--border-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-overlay);
    font-size: var(--text-sm);
  }
  dialog[open] {
    display: flex;
    flex-direction: column;
  }
  dialog::backdrop {
    background: var(--overlay-backdrop);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-4);
    padding: var(--space-6);
  }
  .close:focus-visible {
    outline: none;
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  h2 {
    font-size: var(--text-lg);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-tight);
    margin: var(--space-2) 0;
  }
  p {
    margin: 0;
    color: var(--text-secondary);
    line-height: var(--leading-normal);
  }
  h3 {
    font-size: var(--text-2xs);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
  }
  nav {
    display: flex;
    gap: var(--space-4);
    padding: 0 var(--space-6);
    border-bottom: var(--rule) solid var(--border-default);
  }
  nav button {
    border-radius: 0;
    padding: var(--space-3) 0;
    border-bottom: var(--rule-strong) solid transparent;
  }
  nav button[aria-pressed='true'] {
    color: var(--text-primary);
    border-bottom-color: var(--text-primary);
  }
  .body {
    overflow-y: auto;
    padding: var(--space-5) var(--space-6);
    min-height: 0;
  }
  .examples {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--panel-width)), 1fr));
    gap: var(--space-2);
  }
  .example {
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border: var(--rule) solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
    color: var(--text-primary);
    cursor: pointer;
    font: inherit;
  }
  .example:hover {
    background: var(--bg-hover);
    border-color: var(--border-strong);
  }
  .example-title {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    font-weight: var(--weight-medium);
  }
  .try,
  .description {
    color: var(--text-secondary);
    font-size: var(--text-xs);
    font-weight: var(--weight-regular);
  }
  code,
  pre {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    overflow-wrap: anywhere;
  }
  h3 {
    margin: var(--space-6) 0 var(--space-2);
    color: var(--text-secondary);
  }
  dl {
    margin: 0;
  }
  .syntax-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    gap: var(--space-4);
    padding: var(--space-3) 0;
    border-bottom: var(--rule) solid var(--border-subtle);
  }
  dd {
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--text-xs);
    line-height: var(--leading-normal);
  }
  .note {
    margin: var(--space-4) 0;
    font-size: var(--text-xs);
  }
  details {
    border-top: var(--rule) solid var(--border-default);
    padding-top: var(--space-3);
  }
  summary {
    cursor: pointer;
    font-weight: var(--weight-medium);
  }
  details p {
    margin-top: var(--space-3);
    font-size: var(--text-xs);
  }
  pre {
    white-space: pre-wrap;
    background: var(--bg-inset);
    padding: var(--space-3);
  }
  .input {
    width: 100%;
  }
  .field {
    padding: var(--space-3) 0;
    border-bottom: var(--rule) solid var(--border-subtle);
  }
  .field > div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .field p {
    font-size: var(--text-xs);
    margin-top: var(--space-1);
  }
  .field-type {
    color: var(--text-secondary);
    font-size: var(--text-2xs);
    white-space: nowrap;
  }
  .values {
    font-family: var(--font-mono);
  }
  footer {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-6);
    border-top: var(--rule) solid var(--border-default);
    color: var(--text-secondary);
    font-size: var(--text-2xs);
  }
  @media (max-width: 640px) {
    .syntax-row {
      grid-template-columns: 1fr;
      gap: var(--space-1);
    }
    header,
    .body {
      padding: var(--space-4);
    }
    nav {
      padding: 0 var(--space-4);
    }
  }
</style>
