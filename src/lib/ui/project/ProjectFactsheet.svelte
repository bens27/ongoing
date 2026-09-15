<script lang="ts">
  import type { EntryView } from '$lib/domain/entry-view';
  import type { Catalog } from '../catalog.svelte';
  import { getShellContext } from '../context';
  import { fullDate, relativeAge } from '../format';
  import Icon from '../Icon.svelte';
  import { projectOverview } from '../overview';
  import ActionsMenu from './ActionsMenu.svelte';
  import FieldInspector from './FieldInspector.svelte';
  import { copyProjectPath, projectMenuItems } from './menu';
  import NotesSection from './NotesSection.svelte';
  import ProjectIdentity from './ProjectIdentity.svelte';
  import ProjectPriority from './ProjectPriority.svelte';
  import ProjectSignals, { type SignalTab } from './ProjectSignals.svelte';
  import ReachSection from './ReachSection.svelte';
  import RepositorySection from './RepositorySection.svelte';
  import SignalHistory from './SignalHistory.svelte';
  import StackSection from './StackSection.svelte';
  import WorkSection from './WorkSection.svelte';

  /**
   * The project fact sheet: the same overview the panel shows, arranged wider on `/p/<slug>`.
   * Identity and priority sit side by side at the top; Activity/Codebase and their disclosures run
   * in a left column, Reach and its disclosures in a right column — two contiguous groups in DOM
   * order, so a narrow screen that stacks them reads top to bottom exactly as written here, with
   * no visual reordering to make focus jump. Every section below is the same component the panel
   * composes; this file only decides where each one sits and what the header/footer offer.
   */
  let {
    entry,
    catalog,
    backHref
  }: {
    entry: EntryView;
    catalog: Catalog;
    backHref: string;
  } = $props();

  const shell = getShellContext();
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
      onopenpalette: shell?.openPalette
    })
  );
</script>

<div class="factsheet" data-project-factsheet={entry.slug}>
  <div class="bar">
    <a class="button" href={backHref}>
      <Icon name="list" size={12} /> inventory
    </a>
    <ActionsMenu items={menuItems} label={`More actions for ${entry.name}`} />
  </div>

  <div class="hero">
    <ProjectIdentity
      {entry}
      identity={overview.identity}
      {catalog}
      bind:renaming
      oncopypath={copyPath}
      headingLevel={1}
    />
    <ProjectPriority
      {entry}
      priority={overview.priority}
      {catalog}
      {now}
      bind:editing={priorityEditing}
      oninspect={inspect}
    />
  </div>

  <div class="columns">
    <div class="column" data-column="activity">
      <ProjectSignals {overview} {momentum} {now} bind:tab tabs={['activity', 'codebase']}>
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
    </div>
    <div class="column" data-column="reach">
      <ReachSection {overview} {now}>
        {#snippet chart()}
          <SignalHistory
            kind={entry.kind}
            slug={entry.slug}
            metric="github_stars"
            scannedAt={entry.metrics?.githubScannedAt ?? null}
            unit="stars"
          />
        {/snippet}
      </ReachSection>
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
    </div>
  </div>

  <FieldInspector
    {entry}
    {overview}
    {catalog}
    {now}
    bind:open={inspectorOpen}
    bind:query={inspectorQuery}
  />

  <footer class="foot">
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
  </footer>
</div>

<style>
  .factsheet {
    flex: 1;
    overflow-y: auto;
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-8);
    border-bottom: var(--rule) solid var(--border-subtle);
  }

  .hero,
  .columns {
    display: grid;
    grid-template-columns: var(--factsheet-columns);
    gap: var(--space-8);
    max-width: var(--factsheet-max-width);
    margin: 0 auto;
    padding-inline: var(--space-8);
  }

  .hero {
    align-items: start;
    padding-block: var(--space-6);
  }

  .column {
    min-width: 0;
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    max-width: var(--factsheet-max-width);
    margin: 0 auto;
    padding: var(--space-4) var(--space-8);
    border-top: var(--rule) solid var(--border-default);
    color: var(--text-secondary);
    font-size: var(--text-2xs);
  }

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

  /* Below this, the hero and the two columns collapse to one, in the source order already
     written above: identity, priority, then the left group followed by the right group — Reach
     appears after Repository rather than jumping ahead of Work, which is what the two-column
     grouping already reads as in a straight line. */
  @media (max-width: 860px) {
    .hero,
    .columns {
      grid-template-columns: 1fr;
      padding-inline: var(--space-5);
    }

    .bar {
      padding: var(--space-2) var(--space-5);
    }

    .foot {
      padding: var(--space-3) var(--space-5);
    }
  }
</style>
