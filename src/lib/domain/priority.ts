import {
  attentionViewKeys,
  type AttentionClassifications,
  type AttentionReason,
  type AttentionViewKey
} from './attention';

/**
 * Which attention reason a project overview leads with.
 *
 * `classifyAttentionViews` answers seven independent yes/no questions and lists the reasons behind
 * each; it deliberately has no priority score. A panel still has to pick one thing to say first,
 * and that choice must be a documented rule rather than whichever reason happened to be pushed
 * first. This module is that rule. It is pure and deterministic: the same classifications always
 * rank the same way, ties are broken by stable keys, and nothing here reads a clock, the cached
 * CI state, or anything outside the reasons already classified.
 *
 * ## The ranking
 *
 * Every reason is placed in one of five tiers by its `input` key:
 *
 * 1. **Operational failures and blockers** — the project cannot be worked on or observed as the
 *    owner expects: missing from disk, unresolved collector warnings, a failing CI run, blocked
 *    td items.
 * 2. **Overdue external work and upgrades** — something outside the project is waiting on the
 *    owner or has moved on without them: an old external pull request, stale td items, a
 *    toolchain past end of life or several releases behind, a technology in ring `out`, a ring
 *    whose review date has passed.
 * 3. **Missing decisions** — the catalog is waiting on the owner: a project marked `invest`
 *    whose required fields are not filled in.
 * 4. **Context** — conditions worth knowing but not tasks: the reasons behind `dormant`,
 *    `opportunity`, and `quickwin`.
 * 5. **Positive signals** — `rising` and `momentum`.
 *
 * The primary item is the first reason in tiers 1–3. When no reason reaches those tiers the
 * overview has nothing urgent to say, and the caller shows the stored next action or a calm
 * empty state instead — it must not promote a positive signal or invent a task.
 *
 * Inside a tier, ties resolve by source in the order `catalog, github, td, git, stack, tech,
 * traffic, decision`, then by `input` (code-point order), then by the view key's position in
 * `attentionViewKeys`. A reason that several views share (the same `input`) appears once, at the
 * highest tier it reaches, with every view it belongs to listed.
 *
 * An `input` this module does not know falls into the tier of the view it came from: tier 3 for
 * `attention` and `upgrade`, tier 5 for `rising` and `momentum`, tier 4 otherwise. A new rule in
 * `attention.ts` therefore surfaces without being lost, and gets an explicit tier once someone
 * decides where it belongs.
 */
export type PriorityTier = 1 | 2 | 3 | 4 | 5;

export const PRIORITY_TIER_LABELS: Readonly<Record<PriorityTier, string>> = {
  1: 'failure or blocker',
  2: 'overdue',
  3: 'decision',
  4: 'context',
  5: 'signal'
};

/** Tiers whose items are things to act on; anything below is shown but never leads. */
export const ACTIONABLE_TIER: PriorityTier = 3;

export interface PriorityItem {
  tier: PriorityTier;
  reason: AttentionReason;
  /** Every view this reason contributes to, in `attentionViewKeys` order. */
  views: AttentionViewKey[];
}

export interface PrioritySelection {
  /** The one item the overview leads with, or null when nothing reaches tier 3. */
  primary: PriorityItem | null;
  /** Every other item, ranked, positive signals included — nothing classified is dropped. */
  others: PriorityItem[];
}

/** Exact `input` keys, then prefix rules, in the order they are tried. */
const EXACT_TIERS: Readonly<Record<string, PriorityTier>> = {
  isMissing: 1,
  unresolvedCollectorErrors: 1,
  githubCiState: 1,
  tdBlockedCount: 1,
  githubOldestExternalPrAgeDays: 2,
  tdStaleCount: 2,
  complete: 3
};

const PREFIX_TIERS: readonly { prefix: string; suffix?: string; tier: PriorityTier }[] = [
  { prefix: 'stack.', tier: 2 },
  { prefix: 'tech.', suffix: '.ring', tier: 2 },
  { prefix: 'tech.', suffix: '.reviewAfter', tier: 2 }
];

const VIEW_FALLBACK_TIERS: Readonly<Record<AttentionViewKey, PriorityTier>> = {
  attention: 3,
  upgrade: 3,
  rising: 5,
  momentum: 5,
  dormant: 4,
  opportunity: 4,
  quickwin: 4
};

const SOURCE_ORDER: readonly AttentionReason['source'][] = [
  'catalog',
  'github',
  'td',
  'git',
  'stack',
  'tech',
  'traffic',
  'decision'
];

/** The tier a reason belongs to. Exported so a test can pin the table without ranking. */
export function priorityTier(reason: AttentionReason, view: AttentionViewKey): PriorityTier {
  const exact = EXACT_TIERS[reason.input];
  if (exact) return exact;
  for (const rule of PREFIX_TIERS)
    if (
      reason.input.startsWith(rule.prefix) &&
      (rule.suffix === undefined || reason.input.endsWith(rule.suffix))
    )
      return rule.tier;
  return VIEW_FALLBACK_TIERS[view];
}

function sourceRank(source: AttentionReason['source']): number {
  const index = SOURCE_ORDER.indexOf(source);
  return index === -1 ? SOURCE_ORDER.length : index;
}

function compare(left: PriorityItem, right: PriorityItem): number {
  return (
    left.tier - right.tier ||
    sourceRank(left.reason.source) - sourceRank(right.reason.source) ||
    (left.reason.input < right.reason.input
      ? -1
      : left.reason.input > right.reason.input
        ? 1
        : 0) ||
    attentionViewKeys.indexOf(left.views[0]) - attentionViewKeys.indexOf(right.views[0])
  );
}

/**
 * Rank every classified reason and choose the one to lead with. Null classifications — a kind
 * the attention rules say nothing about — rank as nothing at all.
 */
export function selectPriority(attention: AttentionClassifications | null): PrioritySelection {
  if (!attention) return { primary: null, others: [] };

  const byInput = new Map<string, PriorityItem>();
  for (const view of attentionViewKeys) {
    const classification = attention[view];
    if (!classification?.member) continue;
    for (const reason of classification.reasons) {
      const tier = priorityTier(reason, view);
      const existing = byInput.get(reason.input);
      if (!existing) {
        byInput.set(reason.input, { tier, reason, views: [view] });
        continue;
      }
      if (!existing.views.includes(view)) existing.views.push(view);
      // The same input can carry a different message per view (`commits30d` reads as momentum in
      // one and as an opportunity in another); keep the reason from the highest tier it reaches.
      if (tier < existing.tier) {
        existing.tier = tier;
        existing.reason = reason;
      }
    }
  }

  const ranked = [...byInput.values()]
    .map((item) => ({
      ...item,
      views: [...item.views].sort(
        (left, right) => attentionViewKeys.indexOf(left) - attentionViewKeys.indexOf(right)
      )
    }))
    .sort(compare);
  const primary = ranked[0]?.tier <= ACTIONABLE_TIER ? ranked[0] : null;
  return { primary, others: primary ? ranked.slice(1) : ranked };
}
