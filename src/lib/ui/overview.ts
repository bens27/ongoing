import { ATTENTION_THRESHOLDS, type AttentionReason } from '$lib/domain/attention';
import { entryCompleteness, fieldHasValue, type Completeness } from '$lib/domain/completeness';
import type { EntryView } from '$lib/domain/entry-view';
import { fieldAppliesTo, type FieldDefinition, type FieldRegistry } from '$lib/domain/fields';
import type { ProjectMetrics, ProviderAvailability, WorkflowState } from '$lib/domain/metrics';
import { selectPriority, type PriorityItem } from '$lib/domain/priority';
import type { ResolvedStack } from '$lib/domain/stack';
import type { UsedTechnology } from '$lib/domain/technology';
import { githubUrl } from './links';
import { decisionFields } from './facts';
import { roleField } from './rich-fields';

/**
 * What a project overview shows, prepared once from the entry, the registry, and the clock.
 *
 * The panel and the fact sheet are two layouts of this one model: they differ in where a section
 * sits, never in what it says. Everything here is a pure function of its arguments — no Svelte,
 * no route state, no fetch — so a test can pin every number the panel prints, and a later
 * surface (a CLI `ongoing show` section, say) can reuse it unchanged.
 *
 * Domain rules stay in `domain/`: attention membership, completeness, and the priority ranking.
 * This module groups their results by the question a person asks — what is this, what needs me,
 * is it moving, what is the supporting evidence — and decides how each missing or stale input is
 * described. It never manufactures a value: an input that was not collected reads as "not
 * collected", never as zero.
 */

const HOUR = 3_600_000;

/** How a collector's data stands relative to the attention rules' freshness window. */
export interface Freshness {
  state: 'fresh' | 'stale' | 'never';
  /** Null exactly when the state is `never`. */
  observedAt: string | null;
}

export interface ActionLink {
  kind: 'link';
  label: string;
  href: string;
  external: boolean;
}
export interface ActionEdit {
  kind: 'edit';
  label: string;
  /** The registered field the action edits. */
  key: string;
}
export interface ActionInspect {
  kind: 'inspect';
  label: string;
  /** What the inspector should search for when it opens. */
  query: string;
}
export type OverviewAction = ActionLink | ActionEdit | ActionInspect;

export interface PriorityEvidence {
  message: string;
  input: string;
  value: AttentionReason['value'];
  comparison: string;
  threshold: AttentionReason['threshold'];
  source: AttentionReason['source'];
  /** When the source that produced the input was last observed. */
  freshness: Freshness;
}

export interface OverviewPriorityItem extends PriorityItem {
  /** `error` for failures and blockers, `warn` for overdue work, `info` for missing decisions. */
  tone: 'error' | 'warn' | 'info' | 'neutral' | 'ok';
  action: OverviewAction | null;
  evidence: PriorityEvidence;
}

export interface OverviewPriority {
  primary: OverviewPriorityItem | null;
  others: OverviewPriorityItem[];
  /** The stored next action, shown whether or not anything needs attention. */
  nextAction: string | null;
  /** The registered `next_action` field, when this kind has one, so the panel can edit it. */
  nextActionField: FieldDefinition | null;
  completeness: Completeness;
}

export interface RateBar {
  /** What the bar covers, as a person reads it: "Days 90–31". */
  label: string;
  /** Average commits per day over that range. */
  perDay: number;
  /** 0–1, relative to the busiest of the three bars; the bar's width. */
  share: number;
}

export type ActivityRates =
  | { state: 'ok'; bars: RateBar[] }
  | { state: 'missing'; reason: string }
  | { state: 'inconsistent'; reason: string };

export interface ActivitySummary {
  /** Null when the git collector never ran for this project. */
  commits30d: number | null;
  activeDays30d: number | null;
  commits7d: number | null;
  mergedPrs30d: number | null;
  rates: ActivityRates;
  /** All-time git authors, per the git collector — not a 30-day figure. */
  contributors: number | null;
  /** Contributors as GitHub counts them, when the hosting provider answered. */
  githubContributors: number | null;
  /** Share of the last 30 days' commits by the local author, 0–1. */
  localAuthorShare30d: number | null;
  latestCommit: { subject: string | null; shortSha: string | null; at: string | null } | null;
  git: Freshness;
  github: Freshness;
  githubAvailability: ProviderAvailability | null;
}

export interface ReachSummary {
  visibility: 'public' | 'private' | 'internal' | null;
  /** Provider state; anything but `available` is shown as such, never as zero reach. */
  availability: ProviderAvailability | null;
  stars: number | null;
  starsGained30d: number | null;
  forks: number | null;
  watchers: number | null;
  releaseDownloads: number | null;
  traffic: {
    availability: ProviderAvailability | null;
    views: number | null;
    uniqueVisitors: number | null;
    clones: number | null;
    uniqueCloners: number | null;
    /** The collector reads GitHub's rolling 14-day window; this is when it last did. */
    observedAt: string | null;
  };
  github: Freshness;
}

export interface CodebaseSummary {
  locCode: number | null;
  locComment: number | null;
  locBlank: number | null;
  files: number | null;
  /** Lines in test files. A size, not a coverage figure; the label must say so. */
  testLines: number | null;
  language: string | null;
  loc: Freshness;
}

export interface WorkSummary {
  openIssues: number | null;
  openPrs: number | null;
  draftPrs: number | null;
  externalPrs: number | null;
  oldestExternalPrAt: string | null;
  td: {
    total: number | null;
    open: number | null;
    inProgress: number | null;
    blocked: number | null;
    review: number | null;
    stale: number | null;
  };
  issuesUrl: string | null;
  pullsUrl: string | null;
  github: Freshness;
  githubAvailability: ProviderAvailability | null;
  tdFreshness: Freshness;
}

export interface RepositorySummary {
  branch: string | null;
  headSha: string | null;
  dirtyFiles: number | null;
  ahead: number | null;
  behind: number | null;
  ciState: WorkflowState | null;
  latestTag: string | null;
  commitsSinceLatestTag: number | null;
  latestRelease: { tag: string | null; at: string | null } | null;
  releaseDownloads: number | null;
  archived: boolean | null;
  path: string | null;
  isMissing: boolean;
  remoteSource: { provider: string; locator: string } | null;
  checksUrl: string | null;
  git: Freshness;
  github: Freshness;
  githubAvailability: ProviderAvailability | null;
}

export interface StackSummary {
  technologies: UsedTechnology[];
  /** Names for the collapsed line: everything, in catalog order. */
  names: string[];
  toolchains: ResolvedStack[];
  stack: Freshness;
}

export interface NotesSummary {
  note: string;
  intent: string | null;
  reviewAfter: string | null;
  /** Editable decision fields for this kind, custom fields included, in registry order. */
  fields: FieldDefinition[];
}

export interface IdentitySummary {
  name: string;
  slug: string;
  kind: string;
  /** The one-line purpose: the note, which is the only free text the catalog holds for it. */
  purpose: string;
  intent: string | null;
  visibility: 'public' | 'private' | 'internal' | null;
  isFavorite: boolean;
  isHidden: boolean;
  isMissing: boolean;
  path: string | null;
  remoteSource: { provider: string; locator: string } | null;
  repositoryUrl: string | null;
  /**
   * The configured public site's URL — `EntryView.website`, the owned destination — and nothing
   * else. A `url`-typed field someone registers is a fact about the project, not its website.
   */
  websiteUrl: string | null;
  /** The rich identity field (a logo), when the registry has one and the entry carries it. */
  logoField: FieldDefinition | null;
  updatedAt: string;
}

export interface ProjectOverview {
  identity: IdentitySummary;
  priority: OverviewPriority;
  activity: ActivitySummary | null;
  reach: ReachSummary | null;
  codebase: CodebaseSummary | null;
  work: WorkSummary;
  repository: RepositorySummary;
  stack: StackSummary;
  notes: NotesSummary;
  /** Every collector's last observation, for the footer and the inspector. */
  observed: { collector: string; at: string | null }[];
}

export function freshness(
  observedAt: string | null | undefined,
  hours: number,
  now: number
): Freshness {
  if (!observedAt) return { state: 'never', observedAt: null };
  const parsed = Date.parse(observedAt);
  if (!Number.isFinite(parsed)) return { state: 'never', observedAt: null };
  return { state: now - parsed <= hours * HOUR ? 'fresh' : 'stale', observedAt };
}

/**
 * Average commits per day over three disjoint ranges, derived from the cumulative 7/30/90-day
 * totals the git collector keeps. The windows are `(90d − 30d) / 60`, `(30d − 7d) / 23`, and
 * `7d / 7`, labelled as the days they cover. These are averages over ranges, not daily history;
 * the collector has no per-day series, and nothing here pretends otherwise.
 *
 * A missing total makes the whole comparison unavailable rather than a partial chart, and totals
 * that shrink as the window grows are reported as inconsistent rather than drawn as negative bars.
 */
export function activityRates(
  totals: Pick<ProjectMetrics, 'commits7d' | 'commits30d' | 'commits90d'>
): ActivityRates {
  const { commits7d, commits30d, commits90d } = totals;
  const values = [commits7d, commits30d, commits90d];
  if (values.some((value) => value === null || value === undefined))
    return { state: 'missing', reason: 'Commit totals were not collected' };
  if (values.some((value) => !Number.isFinite(value!) || value! < 0))
    return { state: 'inconsistent', reason: 'Commit totals are not valid counts' };
  if (commits90d! < commits30d! || commits30d! < commits7d!)
    return {
      state: 'inconsistent',
      reason: 'Commit totals shrink as the window grows, so the ranges cannot be compared'
    };
  const perDay = [
    (commits90d! - commits30d!) / 60,
    (commits30d! - commits7d!) / 23,
    commits7d! / 7
  ];
  const peak = Math.max(...perDay);
  const labels = ['Days 90–31', 'Days 30–8', 'Last 7 days'];
  return {
    state: 'ok',
    bars: perDay.map((value, index) => ({
      label: labels[index],
      perDay: value,
      share: peak > 0 ? value / peak : 0
    }))
  };
}

function remoteSourceOf(entry: EntryView): { provider: string; locator: string } | null {
  if (entry.path) return null;
  const source = entry.sources.find((candidate) => candidate.provider !== 'filesystem');
  return source ? { provider: source.provider, locator: source.locator } : null;
}

function numberField(entry: EntryView, key: string): number | null {
  const value = entry.fields[key];
  return typeof value === 'number' ? value : null;
}

function stringField(entry: EntryView, key: string): string | null {
  const value = entry.fields[key];
  return typeof value === 'string' && value ? value : null;
}

/** The collector behind a reason's source, so its freshness can be shown beside the evidence. */
function sourceFreshness(
  source: AttentionReason['source'],
  entry: EntryView,
  now: number
): Freshness {
  const metrics = entry.metrics;
  const hours = ATTENTION_THRESHOLDS.freshnessHours;
  switch (source) {
    case 'git':
      return freshness(metrics?.gitScannedAt, hours.git, now);
    case 'td':
      return freshness(metrics?.tdScannedAt, hours.td, now);
    case 'github':
      return freshness(metrics?.githubScannedAt, hours.github, now);
    case 'traffic':
      return freshness(metrics?.githubTrafficScannedAt, hours.traffic, now);
    case 'stack':
      return freshness(metrics?.stackScannedAt, hours.stack, now);
    default:
      // Catalog facts — a missing directory, an edge, a decision — are as current as the entry.
      return { state: 'fresh', observedAt: entry.updatedAt };
  }
}

function toneFor(item: PriorityItem): OverviewPriorityItem['tone'] {
  switch (item.tier) {
    case 1:
      return 'error';
    case 2:
      return 'warn';
    case 3:
      return 'info';
    case 4:
      return 'neutral';
    default:
      return 'ok';
  }
}

/**
 * The one useful thing to do about a reason. Links go to where the work is; edits open the field
 * the decision lives in; inspections open the field inspector on the evidence. A reason with no
 * obvious action gets none rather than a decorative button.
 */
function actionFor(
  item: PriorityItem,
  entry: EntryView,
  registry: FieldRegistry,
  completeness: Completeness
): OverviewAction | null {
  const { input } = item.reason;
  const repository = githubUrl(entry);
  if (input === 'githubCiState')
    return repository
      ? { kind: 'link', label: 'View checks', href: `${repository}/actions`, external: true }
      : null;
  if (input === 'githubOldestExternalPrAgeDays')
    return repository
      ? { kind: 'link', label: 'Review pull requests', href: `${repository}/pulls`, external: true }
      : null;
  if (input === 'unresolvedCollectorErrors')
    return { kind: 'inspect', label: 'View warnings', query: 'warnings' };
  if (input === 'isMissing') return { kind: 'inspect', label: 'View sources', query: 'path' };
  if (input === 'tdBlockedCount' || input === 'tdStaleCount')
    return { kind: 'inspect', label: 'View td counts', query: 'td.' };
  if (input.startsWith('tech.')) {
    const slug = input.slice('tech.'.length, input.lastIndexOf('.'));
    return { kind: 'link', label: 'Review technology', href: `/t/${slug}`, external: false };
  }
  if (input.startsWith('stack.')) {
    const toolchain = input.split('.')[1];
    return { kind: 'inspect', label: 'View toolchain', query: `stack.${toolchain}` };
  }
  if (input === 'complete') {
    // Completeness names whichever required field is empty. Offer to set the next action only
    // when that is the gap; otherwise offer the first missing field that can be edited here.
    const missing = completeness.missing
      .map((key) => registry.get(key))
      .filter((field): field is FieldDefinition => Boolean(field?.editable));
    const target = missing.find((field) => field.key === 'next_action') ?? missing[0];
    return target
      ? { kind: 'edit', label: `Set ${target.label.toLowerCase()}`, key: target.key }
      : null;
  }
  return null;
}

function decorate(
  item: PriorityItem,
  entry: EntryView,
  registry: FieldRegistry,
  completeness: Completeness,
  now: number
): OverviewPriorityItem {
  return {
    ...item,
    tone: toneFor(item),
    action: actionFor(item, entry, registry, completeness),
    evidence: {
      message: item.reason.message,
      input: item.reason.input,
      value: item.reason.value,
      comparison: item.reason.comparison,
      threshold: item.reason.threshold,
      source: item.reason.source,
      freshness: sourceFreshness(item.reason.source, entry, now)
    }
  };
}

export function overviewPriority(
  entry: EntryView,
  registry: FieldRegistry,
  now: number
): OverviewPriority {
  const completeness = entryCompleteness(registry, entry.kind, entry.fields);
  const selection = selectPriority(entry.attention);
  const nextActionField = registry.get('next_action');
  return {
    primary: selection.primary
      ? decorate(selection.primary, entry, registry, completeness, now)
      : null,
    others: selection.others.map((item) => decorate(item, entry, registry, completeness, now)),
    nextAction: stringField(entry, 'next_action'),
    nextActionField:
      nextActionField && fieldAppliesTo(nextActionField, entry.kind) ? nextActionField : null,
    completeness
  };
}

/** Everything the panel and the fact sheet show, from one entry. Project kinds only. */
export function projectOverview(
  entry: EntryView,
  registry: FieldRegistry,
  now = Date.now()
): ProjectOverview {
  const metrics = entry.metrics;
  const hours = ATTENTION_THRESHOLDS.freshnessHours;
  const git = freshness(metrics?.gitScannedAt, hours.git, now);
  const github = freshness(metrics?.githubScannedAt, hours.github, now);
  const td = freshness(metrics?.tdScannedAt, hours.td, now);
  const loc = freshness(metrics?.locScannedAt, hours.loc, now);
  const stack = freshness(metrics?.stackScannedAt, hours.stack, now);
  const repository = githubUrl(entry);
  const remoteSource = remoteSourceOf(entry);
  const intent = stringField(entry, 'intent');
  const visibility = metrics?.githubVisibility ?? null;

  const activity: ActivitySummary | null = metrics?.gitScannedAt
    ? {
        commits30d: metrics.commits30d,
        activeDays30d: metrics.activeDays30d,
        commits7d: metrics.commits7d,
        mergedPrs30d: metrics.githubMergedPrs30d,
        rates: activityRates(metrics),
        contributors: metrics.contributorCount,
        githubContributors: metrics.githubContributorCount,
        localAuthorShare30d: metrics.localAuthorCommitShare30d,
        latestCommit:
          metrics.latestCommitAt || metrics.latestCommitSubject
            ? {
                subject: metrics.latestCommitSubject,
                shortSha: metrics.latestCommitShortSha,
                at: metrics.latestCommitAt
              }
            : null,
        git,
        github,
        githubAvailability: metrics.githubAvailability
      }
    : null;

  const reach: ReachSummary | null =
    metrics && (metrics.githubScannedAt || metrics.githubAvailability)
      ? {
          visibility,
          availability: metrics.githubAvailability,
          stars: metrics.githubStars,
          starsGained30d: numberField(entry, 'github.starsGained30d'),
          forks: metrics.githubForks,
          watchers: metrics.githubWatchers,
          releaseDownloads: metrics.githubReleaseDownloads,
          traffic: {
            availability: metrics.githubTrafficAvailability,
            views: metrics.githubTrafficViews,
            uniqueVisitors: metrics.githubTrafficUniqueVisitors,
            clones: metrics.githubTrafficClones,
            uniqueCloners: metrics.githubTrafficUniqueCloners,
            observedAt: metrics.githubTrafficScannedAt
          },
          github
        }
      : null;

  const codebase: CodebaseSummary | null =
    metrics && (metrics.locScannedAt || metrics.locCode !== null)
      ? {
          locCode: metrics.locCode,
          locComment: metrics.locComment,
          locBlank: metrics.locBlank,
          files: metrics.locFiles,
          testLines: metrics.locTest,
          language: metrics.dominantLanguage,
          loc
        }
      : null;

  const work: WorkSummary = {
    openIssues: metrics?.githubOpenIssues ?? null,
    openPrs: metrics?.githubOpenPrs ?? null,
    draftPrs: metrics?.githubDraftPrs ?? null,
    externalPrs: metrics?.githubExternalPrs ?? null,
    oldestExternalPrAt: metrics?.githubOldestExternalPrAt ?? null,
    td: {
      total: metrics?.tdTotalNonClosedCount ?? null,
      open: metrics?.tdOpenCount ?? null,
      inProgress: metrics?.tdInProgressCount ?? null,
      blocked: metrics?.tdBlockedCount ?? null,
      review: metrics?.tdReviewCount ?? null,
      stale: metrics?.tdStaleCount ?? null
    },
    issuesUrl: repository ? `${repository}/issues` : null,
    pullsUrl: repository ? `${repository}/pulls` : null,
    github,
    githubAvailability: metrics?.githubAvailability ?? null,
    tdFreshness: td
  };

  const repositorySummary: RepositorySummary = {
    branch: metrics?.branch ?? null,
    headSha: metrics?.headSha ?? null,
    dirtyFiles: metrics?.dirtyFiles ?? null,
    ahead: metrics?.aheadCount ?? null,
    behind: metrics?.behindCount ?? null,
    ciState: metrics?.githubCiState ?? null,
    latestTag: metrics?.latestTag ?? null,
    commitsSinceLatestTag: metrics?.commitsSinceLatestTag ?? null,
    latestRelease:
      metrics?.githubLatestReleaseTag || metrics?.githubLatestReleaseAt
        ? { tag: metrics.githubLatestReleaseTag, at: metrics.githubLatestReleaseAt }
        : null,
    releaseDownloads: metrics?.githubReleaseDownloads ?? null,
    archived: metrics?.githubIsArchived ?? null,
    path: entry.path,
    isMissing: entry.isMissing,
    remoteSource,
    checksUrl: repository ? `${repository}/actions` : null,
    git,
    github,
    githubAvailability: metrics?.githubAvailability ?? null
  };

  return {
    identity: {
      name: entry.name,
      slug: entry.slug,
      kind: entry.kind,
      purpose: entry.note,
      intent,
      visibility,
      isFavorite: entry.isFavorite,
      isHidden: entry.isHidden,
      isMissing: entry.isMissing,
      path: entry.path,
      remoteSource,
      repositoryUrl: repository,
      websiteUrl: entry.website?.url ?? null,
      logoField: (() => {
        const field = roleField(registry, entry.kind, 'identity');
        return field && fieldHasValue(entry.fields[field.key]) ? field : null;
      })(),
      updatedAt: entry.updatedAt
    },
    priority: overviewPriority(entry, registry, now),
    activity,
    reach,
    codebase,
    work,
    repository: repositorySummary,
    stack: {
      technologies: entry.technologies,
      names: entry.technologies.map((technology) => technology.name),
      toolchains: entry.stacks,
      stack
    },
    notes: {
      note: entry.note,
      intent,
      reviewAfter: entry.reviewAfter,
      fields: decisionFields(registry, entry.kind).filter((field) => !field.presentation)
    },
    observed: [
      { collector: 'git', at: metrics?.gitScannedAt ?? null },
      { collector: 'loc', at: metrics?.locScannedAt ?? null },
      { collector: 'td', at: metrics?.tdScannedAt ?? null },
      { collector: 'github', at: metrics?.githubScannedAt ?? null },
      { collector: 'traffic', at: metrics?.githubTrafficScannedAt ?? null },
      { collector: 'stack', at: metrics?.stackScannedAt ?? null }
    ]
  };
}

/**
 * The inspector's rows: every registered field for the kind, value or not, in registry order.
 * Filtering is a plain substring match over key, label, description, owner, and the rendered
 * value, so a custom field someone registered a minute ago is as findable as a built-in one.
 */
export interface InspectorRow {
  field: FieldDefinition;
  value: EntryView['fields'][string] | undefined;
  hasValue: boolean;
  /** `core`, `user`, or the provider name. */
  owner: string;
}

export function inspectorRows(entry: EntryView, registry: FieldRegistry): InspectorRow[] {
  return registry.forKind(entry.kind).map((field) => ({
    field,
    value: entry.fields[field.key],
    hasValue: fieldHasValue(entry.fields[field.key]),
    owner: field.owner.startsWith('provider:') ? field.owner.slice('provider:'.length) : field.owner
  }));
}

export function filterInspectorRows(rows: InspectorRow[], query: string): InspectorRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    [
      row.field.key,
      row.field.label,
      row.field.description ?? '',
      row.owner,
      row.hasValue ? JSON.stringify(row.value) : ''
    ]
      .join(' ')
      .toLowerCase()
      .includes(needle)
  );
}
