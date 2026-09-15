<script lang="ts">
  import type { EntryView } from '$lib/domain/entry-view';
  import type { Catalog } from '../catalog.svelte';
  import { fullDate, relativeAge } from '../format';
  import Icon from '../Icon.svelte';
  import { projectOverview } from '../overview';
  import Panel from '../Panel.svelte';
  import ActionsMenu from './ActionsMenu.svelte';
  import FieldInspector from './FieldInspector.svelte';
  import { copyProjectPath, projectMenuItems } from './menu';
  import NotesSection from './NotesSection.svelte';
  import ProjectIdentity from './ProjectIdentity.svelte';
  import ProjectPriority from './ProjectPriority.svelte';
  import ProjectSignals, { type SignalTab } from './ProjectSignals.svelte';
  import RepositorySection from './RepositorySection.svelte';
  import SignalHistory from './SignalHistory.svelte';
  import StackSection from './StackSection.svelte';
  import WorkSection from './WorkSection.svelte';

  /**
   * The project overview in the inventory's detail column, composed through the shared `Panel`
   * shell in its wide variant. Reading order: identity, what needs you, is it moving, then the
   * supporting sections behind disclosures, with the full field inspector one click away in the
   * footer. Every section is a component the fact sheet composes again in its own layout; this
   * file decides only the panel's order and what goes in the shell's actions and footer.
   *
   * Disclosure state, the signal tab, and any open editor live here. The owner keys this
   * component by entry id, so they reset when a different project opens and survive when the
   * same project's row is replaced by a background refresh or another edit.
   */
  let {
    entry,
    catalog,
    factSheetHref,
    onclose,
    onopenpalette
  }: {
    entry: EntryView;
    catalog: Catalog;
    factSheetHref: string;
    onclose: () => void;
    onopenpalette?: () => void;
  } = $props();

  const now = Date.now();

  let overview = $derived(projectOverview(entry, catalog.registry, now));
  let momentum = $derived(entry.views.includes('momentum'));

  let tab = $state<SignalTab>('activity');
  let sections = $state({ work: false, repository: false, stack: false, notes: false });
  let renaming = $state(false);
  let priorityEditing = $state<string | null>(null);
  let notesEditing = $state<string | null>(null);
  let inspectorOpen = $state(false);
  let inspectorQuery = $state('');

  let latestObservation = $derived(
    overview.observed
      .map((item) => item.at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null
  );

  function inspect(query = '') {
    inspectorQuery = query;
    inspectorOpen = true;
  }

  async function copyPath() {
    await copyProjectPath(entry, catalog, inspect);
  }

  let menuItems = $derived.by(() =>
    projectMenuItems({
      entry,
      overview,
      catalog,
      onrename: () => (renaming = true),
      oncopypath: () => void copyPath(),
      oninspect: inspect,
      onopenpalette
    })
  );
</script>

<Panel title={entry.name} eyebrow="Project overview" variant="wide" {onclose}>
  {#snippet actions()}
    <a class="button" href={factSheetHref}>
      <Icon name="external-link" size={12} /> fact sheet
    </a>
    <ActionsMenu items={menuItems} label={`More actions for ${entry.name}`} />
  {/snippet}

  <div class="overview" data-project-panel={entry.slug}>
    <ProjectIdentity
      {entry}
      identity={overview.identity}
      {catalog}
      bind:renaming
      oncopypath={copyPath}
    />
    <ProjectPriority
      {entry}
      priority={overview.priority}
      {catalog}
      {now}
      bind:editing={priorityEditing}
      oninspect={inspect}
    />
    <ProjectSignals {overview} {momentum} {now} bind:tab>
      {#snippet reachChart()}
        <SignalHistory
          kind={entry.kind}
          slug={entry.slug}
          metric="github_stars"
          scannedAt={entry.metrics?.githubScannedAt ?? null}
          unit="stars"
        />
      {/snippet}
      {#snippet codebaseChart()}
        <SignalHistory
          kind={entry.kind}
          slug={entry.slug}
          metric="loc_code"
          scannedAt={entry.metrics?.locScannedAt ?? null}
          unit="lines of code"
        />
      {/snippet}
    </ProjectSignals>
    <WorkSection work={overview.work} {now} bind:open={sections.work} />
    <RepositorySection repository={overview.repository} {now} bind:open={sections.repository} />
    <StackSection stack={overview.stack} {now} bind:open={sections.stack} />
    <NotesSection
      {entry}
      notes={overview.notes}
      priority={overview.priority}
      {catalog}
      {now}
      bind:open={sections.notes}
      bind:editing={notesEditing}
    />
    <FieldInspector
      {entry}
      {overview}
      {catalog}
      {now}
      bind:open={inspectorOpen}
      bind:query={inspectorQuery}
    />
  </div>

  {#snippet footer()}
    <span class="meta" title={latestObservation ? fullDate(latestObservation) : undefined}>
      <Icon name="clock" size={11} />
      {#if latestObservation}
        Snapshot · {relativeAge(latestObservation, now)} ago
      {:else}
        No collector has run yet
      {/if}
    </span>
    <button class="inspect" type="button" onclick={() => inspect()}>
      All fields &amp; sources <Icon name="chevron-right" size={11} />
    </button>
  {/snippet}
</Panel>

<style>
  .meta {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  .inspect {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0;
    border: 0;
    background: none;
    color: var(--text-secondary);
    font-size: var(--text-2xs);
    cursor: pointer;
  }

  .inspect:hover {
    color: var(--text-primary);
  }
</style>
