import { describe, expect, it } from 'vitest';
import { classifyAttentionViews } from '$lib/domain/attention';
import { entryCompleteness } from '$lib/domain/completeness';
import type { EntryView } from '$lib/domain/entry-view';
import { createFieldRegistry } from '$lib/domain/fields';
import type { ProjectMetrics } from '$lib/domain/metrics';
import { reclassify } from '$lib/domain/optimistic';
import {
  activityRates,
  filterInspectorRows,
  freshness,
  inspectorRows,
  projectOverview
} from './overview';

const NOW = Date.parse('2026-09-14T12:00:00Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (agoMs: number) => new Date(NOW - agoMs).toISOString();

const registry = createFieldRegistry([
  {
    key: 'x.homepage',
    kinds: ['project'],
    type: 'url',
    owner: 'user',
    label: 'Homepage',
    sortable: false,
    filterable: true,
    editable: true,
    required: false,
    storage: 'attribute'
  }
]);

function metrics(partial: Partial<ProjectMetrics> = {}): ProjectMetrics {
  return {
    projectId: 'p1',
    headSha: null,
    branch: null,
    latestCommitAt: null,
    latestCommitSubject: null,
    latestCommitShortSha: null,
    commitCount: null,
    commits7d: null,
    commits30d: null,
    commits90d: null,
    activeDays30d: null,
    activeDays90d: null,
    churnAdded30d: null,
    churnDeleted30d: null,
    churnAdded90d: null,
    churnDeleted90d: null,
    contributorCount: null,
    localAuthorCommitShare30d: null,
    dirtyFiles: null,
    aheadCount: null,
    behindCount: null,
    latestTag: null,
    commitsSinceLatestTag: null,
    locCode: null,
    locComment: null,
    locBlank: null,
    locFiles: null,
    locTest: null,
    dominantLanguage: null,
    locFingerprint: null,
    tdOpenCount: null,
    tdInProgressCount: null,
    tdBlockedCount: null,
    tdReviewCount: null,
    tdTotalNonClosedCount: null,
    tdStaleCount: null,
    githubRepoId: null,
    githubOwner: null,
    githubName: null,
    githubVisibility: null,
    githubIsArchived: null,
    githubStars: null,
    githubForks: null,
    githubWatchers: null,
    githubOpenIssues: null,
    githubOpenPrs: null,
    githubDraftPrs: null,
    githubReadyPrs: null,
    githubOwnerPrs: null,
    githubExternalPrs: null,
    githubOldestExternalPrAt: null,
    githubMergedPrs30d: null,
    githubMergedPrs90d: null,
    githubExternalIssues30d: null,
    githubExternalIssues90d: null,
    githubLatestReleaseAt: null,
    githubLatestReleaseTag: null,
    githubReleaseDownloads: null,
    githubCiState: null,
    githubContributorCount: null,
    githubTrafficViews: null,
    githubTrafficUniqueVisitors: null,
    githubTrafficClones: null,
    githubTrafficUniqueCloners: null,
    githubAvailability: null,
    githubTrafficAvailability: null,
    gitScannedAt: null,
    locScannedAt: null,
    stackScannedAt: null,
    tdScannedAt: null,
    githubScannedAt: null,
    githubTrafficScannedAt: null,
    ...partial
  };
}

/** An entry as the read model would hand it over, classified by the real rules. */
function entry(
  overrides: Partial<EntryView> & { metrics?: ProjectMetrics | null } = {},
  attributes: Record<string, string | number> = {}
): EntryView {
  const base: EntryView = {
    id: 'p1',
    kind: 'project',
    slug: 'alpha',
    name: 'alpha',
    note: 'release after parser cleanup',
    tags: [],
    isFavorite: false,
    isHidden: false,
    reviewAfter: null,
    path: '/code/alpha',
    isMissing: false,
    website: null,
    attributes: { ...attributes },
    fields: {
      kind: 'project',
      name: 'alpha',
      slug: 'alpha',
      note: 'release after parser cleanup',
      ...attributes
    },
    views: [],
    attention: null,
    metrics: null,
    stacks: [],
    errors: [],
    technologies: [],
    sources: [{ provider: 'filesystem', locator: '/code/alpha' } as EntryView['sources'][number]],
    relations: { outgoing: [], incoming: [] },
    createdAt: at(30 * DAY),
    updatedAt: at(HOUR),
    ...overrides
  };
  if (base.metrics) {
    for (const [key, value] of Object.entries({
      'github.owner': base.metrics.githubOwner,
      'github.name': base.metrics.githubName,
      'github.visibility': base.metrics.githubVisibility
    }))
      if (value) base.fields[key] = value;
  }
  return reclassify(base, registry, NOW);
}

describe('activityRates', () => {
  it('derives three disjoint per-day averages from cumulative totals', () => {
    // Independently: (31 − 18) / 60 = 0.21667, (18 − 8) / 23 = 0.43478, 8 / 7 = 1.14286.
    const rates = activityRates({ commits7d: 8, commits30d: 18, commits90d: 31 });
    expect(rates.state).toBe('ok');
    if (rates.state !== 'ok') return;
    expect(rates.bars.map((bar) => bar.label)).toEqual(['Days 90–31', 'Days 30–8', 'Last 7 days']);
    expect(rates.bars[0].perDay).toBeCloseTo(13 / 60, 10);
    expect(rates.bars[1].perDay).toBeCloseTo(10 / 23, 10);
    expect(rates.bars[2].perDay).toBeCloseTo(8 / 7, 10);
    // Widths are relative to the busiest range, which is the last week here.
    expect(rates.bars[2].share).toBe(1);
    expect(rates.bars[0].share).toBeCloseTo(13 / 60 / (8 / 7), 10);
    expect(rates.bars[1].share).toBeCloseTo(10 / 23 / (8 / 7), 10);
  });

  it('draws nothing for a project with no commits rather than dividing by zero', () => {
    const rates = activityRates({ commits7d: 0, commits30d: 0, commits90d: 0 });
    expect(rates).toEqual({
      state: 'ok',
      bars: [
        { label: 'Days 90–31', perDay: 0, share: 0 },
        { label: 'Days 30–8', perDay: 0, share: 0 },
        { label: 'Last 7 days', perDay: 0, share: 0 }
      ]
    });
  });

  it('puts all the activity in the last week when every commit is recent', () => {
    const rates = activityRates({ commits7d: 5, commits30d: 5, commits90d: 5 });
    expect(rates.state).toBe('ok');
    if (rates.state !== 'ok') return;
    expect(rates.bars.map((bar) => bar.perDay)).toEqual([0, 0, 5 / 7]);
    expect(rates.bars.map((bar) => bar.share)).toEqual([0, 0, 1]);
  });

  it('refuses to draw negative widths from totals that shrink as the window grows', () => {
    expect(activityRates({ commits7d: 10, commits30d: 5, commits90d: 20 })).toMatchObject({
      state: 'inconsistent'
    });
    expect(activityRates({ commits7d: 1, commits30d: 30, commits90d: 20 })).toMatchObject({
      state: 'inconsistent'
    });
    expect(activityRates({ commits7d: -1, commits30d: 3, commits90d: 3 })).toMatchObject({
      state: 'inconsistent'
    });
  });

  it('reports a missing total as missing rather than as zero', () => {
    expect(activityRates({ commits7d: 3, commits30d: 9, commits90d: null })).toMatchObject({
      state: 'missing'
    });
    expect(activityRates({ commits7d: null, commits30d: null, commits90d: null })).toMatchObject({
      state: 'missing'
    });
  });
});

describe('freshness', () => {
  it('is fresh inside the window, stale past it, and never without an observation', () => {
    expect(freshness(at(71 * HOUR), 72, NOW)).toEqual({
      state: 'fresh',
      observedAt: at(71 * HOUR)
    });
    expect(freshness(at(73 * HOUR), 72, NOW)).toEqual({
      state: 'stale',
      observedAt: at(73 * HOUR)
    });
    expect(freshness(null, 72, NOW)).toEqual({ state: 'never', observedAt: null });
    expect(freshness('not a date', 72, NOW)).toEqual({ state: 'never', observedAt: null });
  });
});

describe('projectOverview', () => {
  it('leads with the blocker, keeps the rest as +N more, and names the action', () => {
    const view = entry({
      metrics: metrics({
        gitScannedAt: at(HOUR),
        tdScannedAt: at(HOUR),
        githubScannedAt: at(HOUR),
        githubAvailability: 'available',
        githubOwner: 'example',
        githubName: 'alpha',
        githubCiState: 'failure',
        tdBlockedCount: 1,
        tdStaleCount: 2,
        githubOldestExternalPrAt: at(37 * DAY),
        commits7d: 8,
        commits30d: 18,
        commits90d: 31
      })
    });
    const overview = projectOverview(view, registry, NOW);
    expect(overview.priority.primary).toMatchObject({
      tier: 1,
      tone: 'error',
      reason: { input: 'githubCiState' },
      action: { kind: 'link', href: 'https://github.com/example/alpha/actions' },
      evidence: { source: 'github', freshness: { state: 'fresh' } }
    });
    // Ranked: the td blocker (tier 1), then the two overdue items by source (github before td),
    // then the momentum reason, which is kept but never leads.
    expect(overview.priority.others.map((item) => item.reason.input)).toEqual([
      'tdBlockedCount',
      'githubOldestExternalPrAgeDays',
      'tdStaleCount',
      'commits30d'
    ]);
    expect(
      overview.priority.others.find((item) => item.reason.input === 'tdBlockedCount')?.action
    ).toMatchObject({ kind: 'inspect', query: 'td.' });
  });

  it('offers to set the next action only when that is the required field missing', () => {
    const invest = entry({ metrics: metrics({ gitScannedAt: at(HOUR) }) }, { intent: 'invest' });
    const overview = projectOverview(invest, registry, NOW);
    expect(overview.priority.primary).toMatchObject({
      tier: 3,
      tone: 'info',
      reason: { input: 'complete' },
      action: { kind: 'edit', key: 'next_action', label: 'Set next action' }
    });
    expect(overview.priority.completeness).toEqual(
      entryCompleteness(registry, 'project', invest.fields)
    );

    // With the next action present the gap is intent, and the action says so.
    const noIntent = entry(
      { metrics: metrics({ gitScannedAt: at(HOUR) }) },
      { next_action: 'ship' }
    );
    expect(projectOverview(noIntent, registry, NOW).priority.primary).toBeNull();
    expect(projectOverview(noIntent, registry, NOW).priority.nextAction).toBe('ship');
  });

  it('has nothing to lead with for a project that is only moving well', () => {
    const view = entry({
      metrics: metrics({
        gitScannedAt: at(HOUR),
        commits7d: 8,
        commits30d: 18,
        commits90d: 31,
        activeDays30d: 9
      })
    });
    expect(view.views).toEqual(['momentum']);
    const overview = projectOverview(view, registry, NOW);
    expect(overview.priority.primary).toBeNull();
    expect(
      overview.priority.others.map((item) => [item.tier, item.tone, item.reason.input])
    ).toEqual([
      [5, 'ok', 'activeDays30d'],
      [5, 'ok', 'commits30d']
    ]);
  });

  it('describes a project the git collector never saw without inventing activity', () => {
    const overview = projectOverview(entry({ metrics: null }), registry, NOW);
    expect(overview.activity).toBeNull();
    expect(overview.reach).toBeNull();
    expect(overview.codebase).toBeNull();
    expect(overview.work.td.total).toBeNull();
    expect(overview.work.github).toEqual({ state: 'never', observedAt: null });
    expect(overview.repository.git).toEqual({ state: 'never', observedAt: null });
    expect(overview.observed.every((item) => item.at === null)).toBe(true);
  });

  it('keeps stale and unavailable inputs distinct from quiet ones', () => {
    const view = entry({
      metrics: metrics({
        gitScannedAt: at(5 * DAY),
        commits7d: 0,
        commits30d: 0,
        commits90d: 0,
        githubScannedAt: at(HOUR),
        githubAvailability: 'rate_limited',
        githubVisibility: 'public',
        githubStars: 12,
        githubTrafficAvailability: 'unauthenticated'
      })
    });
    const overview = projectOverview(view, registry, NOW);
    expect(overview.activity?.git).toEqual({ state: 'stale', observedAt: at(5 * DAY) });
    expect(overview.activity?.rates).toMatchObject({ state: 'ok' });
    expect(overview.reach).toMatchObject({
      availability: 'rate_limited',
      stars: 12,
      traffic: { availability: 'unauthenticated', views: null }
    });
  });

  it('links the configured website, never an unrelated custom url field', () => {
    const website = {
      included: true,
      allowPrivateRepository: false,
      slug: 'alpha',
      name: 'Alpha',
      tagline: 'A parser',
      description: 'A parser for things',
      category: 'Tool',
      year: '2026',
      stack: 'TypeScript',
      url: 'https://alpha.example/',
      status: 'Active',
      order: 0,
      artworkId: 1
    };
    const configured = projectOverview(
      entry({ website }, { 'x.homepage': 'https://unrelated.example' }),
      registry,
      NOW
    );
    expect(configured.identity.websiteUrl).toBe('https://alpha.example/');
    // A custom url field alone is not a website: the action stays absent rather than misfiled.
    const unrelated = projectOverview(
      entry({}, { 'x.homepage': 'https://unrelated.example' }),
      registry,
      NOW
    );
    expect(unrelated.identity.websiteUrl).toBeNull();
    expect(unrelated.notes.fields.map((field) => field.key)).toContain('x.homepage');
  });

  it('carries identity: purpose, visibility, links, remote source, and the logo field', () => {
    const remote = entry(
      {
        path: null,
        sources: [
          { provider: 'github', locator: 'example/remote' } as EntryView['sources'][number]
        ],
        metrics: metrics({
          githubScannedAt: at(HOUR),
          githubOwner: 'example',
          githubName: 'remote',
          githubVisibility: 'private'
        })
      },
      { 'x.homepage': 'https://example.test' }
    );
    const overview = projectOverview(remote, registry, NOW);
    expect(overview.identity).toMatchObject({
      purpose: 'release after parser cleanup',
      visibility: 'private',
      path: null,
      remoteSource: { provider: 'github', locator: 'example/remote' },
      repositoryUrl: 'https://github.com/example/remote',
      websiteUrl: null,
      logoField: null
    });
    expect(overview.repository.remoteSource).toEqual({
      provider: 'github',
      locator: 'example/remote'
    });
  });

  it('lists decision fields for the notes section, custom fields included', () => {
    const overview = projectOverview(entry(), registry, NOW);
    const keys = overview.notes.fields.map((field) => field.key);
    expect(keys).toContain('next_action');
    expect(keys).toContain('intent');
    expect(keys).toContain('x.homepage');
    expect(keys).not.toContain('name');
    expect(keys).not.toContain('git.commits30d');
  });
});

describe('inspector rows', () => {
  it('discovers every registered field for the kind, empty ones included', () => {
    const rows = inspectorRows(entry(), registry);
    const byKey = Object.fromEntries(rows.map((row) => [row.field.key, row]));
    expect(byKey['x.homepage']).toMatchObject({ hasValue: false, owner: 'user' });
    expect(byKey['git.commits30d']).toMatchObject({ hasValue: false, owner: 'git' });
    expect(byKey.note).toMatchObject({ hasValue: true, owner: 'core' });
    expect(byKey.ring).toBeUndefined();
  });

  it('filters by key, label, owner, description, or value', () => {
    const rows = inspectorRows(entry(), registry);
    expect(filterInspectorRows(rows, 'homepage').map((row) => row.field.key)).toEqual([
      'x.homepage'
    ]);
    expect(filterInspectorRows(rows, 'parser cleanup').map((row) => row.field.key)).toEqual([
      'note'
    ]);
    expect(filterInspectorRows(rows, 'td.blocked').map((row) => row.owner)).toEqual(['td']);
    expect(filterInspectorRows(rows, '')).toBe(rows);
  });
});

// A classification the panel leads with is the same one the inventory row carries: both come from
// `classifyAttentionViews` over the same entry, so this guards against the overview re-deriving it.
describe('agreement with the row', () => {
  it('ranks exactly the reasons the classifier produced', () => {
    const view = entry({
      metrics: metrics({ gitScannedAt: at(HOUR), tdScannedAt: at(HOUR), tdBlockedCount: 3 })
    });
    const classified = classifyAttentionViews(
      {
        id: view.id,
        isMissing: false,
        intent: null,
        metrics: view.metrics,
        stacks: [],
        errors: [],
        githubStarsGained30d: null,
        githubTrafficViewsDelta30d: null,
        githubTrafficClonesDelta30d: null
      },
      NOW
    );
    const overview = projectOverview(view, registry, NOW);
    expect(overview.priority.primary?.reason).toEqual(classified.attention.reasons[0]);
  });
});
