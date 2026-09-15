<script lang="ts">
  import type { EntryView } from '$lib/domain/entry-view';
  import { PRIORITY_TIER_LABELS } from '$lib/domain/priority';
  import Badge from '../Badge.svelte';
  import type { Catalog } from '../catalog.svelte';
  import FieldEditor from '../FieldEditor.svelte';
  import { fullDate, relativeAge } from '../format';
  import Icon from '../Icon.svelte';
  import type {
    Freshness,
    OverviewAction,
    OverviewPriority,
    OverviewPriorityItem
  } from '../overview';
  import { VIEW_LABELS } from '../views';

  /**
   * What needs you: one primary item chosen by the documented ranking in `domain/priority.ts`,
   * the useful action for it, "Why this?" with the classified evidence, and "+N more" for the
   * rest. When nothing ranks, the stored next action leads; when there is none either, a calm
   * empty state — never an invented task or a health score.
   *
   * The next-action draft lives in the editor below and is committed only by Save or Enter, so
   * switching signal tabs or a background refresh cannot lose or submit it.
   */
  let {
    entry,
    priority,
    catalog,
    now,
    editing = $bindable<string | null>(null),
    oninspect
  }: {
    entry: EntryView;
    priority: OverviewPriority;
    catalog: Catalog;
    now: number;
    /** The decision field being edited here, if any; bindable so the owner can open it. */
    editing?: string | null;
    oninspect: (query: string) => void;
  } = $props();

  let showWhy = $state(false);
  let showOthers = $state(false);
  let editor = $state<FieldEditor | null>(null);

  let primary = $derived(priority.primary);
  let editingField = $derived(editing ? (catalog.registry.get(editing) ?? null) : null);
  let nextActionKey = $derived(priority.nextActionField?.key ?? null);

  const TIER_HINTS: Record<number, string> = {
    1: 'Clear this before picking up the next change.',
    2: 'Something outside the project is waiting on you.',
    3: 'The catalog is waiting on a decision.',
    4: 'Worth knowing; not a task.',
    5: 'A good sign, kept for the record.'
  };

  function act(action: OverviewAction) {
    if (action.kind === 'inspect') oninspect(action.query);
    else if (action.kind === 'edit') editing = action.key;
  }

  function save(key: string, value: Parameters<Catalog['setField']>[2]) {
    editing = null;
    void catalog.setField(entry, key, value);
  }

  function observed(freshness: Freshness): string {
    if (freshness.state === 'never') return 'never observed';
    return `${freshness.state === 'stale' ? 'stale · ' : ''}observed ${relativeAge(freshness.observedAt, now)} ago`;
  }

  function viewsLabel(item: OverviewPriorityItem): string {
    return item.views.map((view) => VIEW_LABELS[view] ?? view).join(', ');
  }
</script>

<section class="focus" aria-label="Priority and next action" data-section="priority">
  <div class="head">
    <span class="eyebrow">{primary ? 'Needs attention' : 'Next move'}</span>
    {#if primary}
      <Badge tone={primary.tone} dot>{PRIORITY_TIER_LABELS[primary.tier]}</Badge>
    {:else if priority.nextAction}
      <Badge tone="info" dot>next action</Badge>
    {:else}
      <Badge tone="neutral">nothing pending</Badge>
    {/if}
  </div>

  <h3>
    {#if primary}
      {primary.reason.message}
    {:else if priority.nextAction}
      {priority.nextAction}
    {:else}
      Nothing needs attention
    {/if}
  </h3>
  <p class="explain">
    {#if primary}
      {TIER_HINTS[primary.tier]}
    {:else if priority.nextAction}
      The next action you recorded. Nothing classified needs you first.
    {:else}
      No attention rule matched, and no next action is recorded.
    {/if}
  </p>

  {#if primary && priority.nextAction}
    <p class="next-action">
      <span class="label">Next action</span>
      <span>{priority.nextAction}</span>
    </p>
  {/if}

  {#if editingField}
    <div class="editor" data-editing={editingField.key}>
      <span class="label">{editingField.label}</span>
      <FieldEditor
        bind:this={editor}
        definition={editingField}
        value={entry.fields[editingField.key]}
        ariaLabel={`${editingField.label} for ${entry.name}`}
        commitOnBlur={false}
        onsave={(value) => save(editingField!.key, value)}
        oncancel={() => (editing = null)}
      />
      <div class="actions">
        <button class="button button-primary" type="button" onclick={() => editor?.submit()}>
          Save {editingField.label.toLowerCase()}
        </button>
        <button class="button" type="button" onclick={() => (editing = null)}>Cancel</button>
      </div>
    </div>
  {:else}
    <div class="actions">
      {#if primary?.action}
        {@const action = primary.action}
        {#if action.kind === 'link'}
          <a
            class="button button-primary"
            href={action.href}
            target={action.external ? '_blank' : undefined}
            rel={action.external ? 'noreferrer' : undefined}
          >
            {action.label}
            {#if action.external}<Icon name="external-link" size={11} />{/if}
          </a>
        {:else}
          <button class="button button-primary" type="button" onclick={() => act(action)}>
            {action.label}
          </button>
        {/if}
      {/if}
      {#if nextActionKey && primary?.action?.kind !== 'edit'}
        <button
          class="button"
          class:button-primary={!primary}
          type="button"
          onclick={() => (editing = nextActionKey)}
        >
          <Icon name={priority.nextAction ? 'pencil' : 'plus'} size={11} />
          {priority.nextAction ? 'Edit next action' : 'Set next action'}
        </button>
      {/if}
      {#if primary}
        <button
          class="why"
          type="button"
          aria-expanded={showWhy}
          aria-controls="priority-evidence"
          onclick={() => (showWhy = !showWhy)}
        >
          Why this?
        </button>
      {/if}
    </div>
  {/if}

  {#if primary && showWhy}
    <div class="evidence" id="priority-evidence">
      <p>{primary.evidence.message}</p>
      <code class="u-mono"
        >{primary.evidence.input}: {String(primary.evidence.value)}
        {primary.evidence.comparison}
        {String(primary.evidence.threshold)}</code
      >
      <p
        class="meta"
        title={primary.evidence.freshness.state === 'never'
          ? undefined
          : fullDate(primary.evidence.freshness.observedAt)}
      >
        Source: {primary.evidence.source} · {observed(primary.evidence.freshness)} · views: {viewsLabel(
          primary
        )}
      </p>
    </div>
  {/if}

  {#if priority.others.length}
    <button
      class="more"
      type="button"
      aria-expanded={showOthers}
      aria-controls="priority-others"
      onclick={() => (showOthers = !showOthers)}
    >
      <Icon name={showOthers ? 'chevron-down' : 'chevron-right'} size={11} />
      {#if primary}+{priority.others.length} more{:else}{priority.others.length} signal{priority
          .others.length === 1
          ? ''
          : 's'}{/if}
    </button>
    {#if showOthers}
      <ul class="others" id="priority-others">
        {#each priority.others as item (item.reason.input)}
          <li>
            <Badge tone={item.tone} dot>{PRIORITY_TIER_LABELS[item.tier]}</Badge>
            <span class="other-message">{item.reason.message}</span>
            <code class="u-mono"
              >{item.reason.input}: {String(item.reason.value)}
              {item.reason.comparison}
              {String(item.reason.threshold)} · {item.reason.source} · {observed(
                item.evidence.freshness
              )}</code
            >
            {#if item.action?.kind === 'link'}
              <a
                class="other-action"
                href={item.action.href}
                target={item.action.external ? '_blank' : undefined}
                rel={item.action.external ? 'noreferrer' : undefined}>{item.action.label}</a
              >
            {:else if item.action}
              {@const action = item.action}
              <button class="other-action" type="button" onclick={() => act(action)}
                >{action.label}</button
              >
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .focus {
    margin: 0 var(--space-4) var(--space-3);
    padding: var(--space-3);
    background: var(--bg-inset);
    border: var(--rule) solid var(--border-default);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .eyebrow {
    color: var(--text-secondary);
    font-size: var(--text-2xs);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
  }

  h3 {
    margin: var(--space-2) 0 0;
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    line-height: var(--leading-normal);
    overflow-wrap: anywhere;
  }

  .explain {
    margin: var(--space-1) 0 var(--space-3);
    color: var(--text-secondary);
    font-size: var(--text-xs);
    line-height: var(--leading-normal);
  }

  .next-action {
    display: flex;
    flex-direction: column;
    gap: var(--space-half);
    margin: 0 0 var(--space-3);
    font-size: var(--text-xs);
  }

  .label {
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .why,
  .more,
  .other-action {
    padding: 0;
    border: 0;
    background: none;
    color: var(--text-secondary);
    font-size: var(--text-2xs);
    cursor: pointer;
  }

  .why {
    margin-left: auto;
  }

  .why:hover,
  .more:hover,
  .other-action:hover {
    color: var(--text-primary);
  }

  .evidence {
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: var(--rule) solid var(--border-subtle);
    color: var(--text-secondary);
    font-size: var(--text-xs);
    overflow-wrap: anywhere;
  }

  .evidence p {
    margin: 0;
  }

  .evidence code {
    display: block;
    margin-top: var(--space-1);
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
  }

  .meta {
    margin-top: var(--space-1) !important;
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
  }

  .more {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    margin-top: var(--space-3);
  }

  .others {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: var(--space-2) 0 0;
    padding: 0;
    list-style: none;
  }

  .others li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
  }

  .other-message {
    flex: 1;
    min-width: 0;
  }

  .others code {
    flex-basis: 100%;
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
  }

  .other-action {
    text-decoration: underline;
    text-underline-offset: var(--space-half);
  }
</style>
