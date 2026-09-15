import { describe, expect, it } from 'vitest';
import {
  attentionViewKeys,
  type AttentionClassifications,
  type AttentionReason,
  type AttentionViewKey
} from './attention';
import { priorityTier, selectPriority } from './priority';

function reason(
  input: string,
  source: AttentionReason['source'] = 'git',
  message = input
): AttentionReason {
  return { source, message, input, value: 1, comparison: '>', threshold: 0 };
}

/** Classifications with only the named views populated; every other view is a non-member. */
function classified(
  views: Partial<Record<AttentionViewKey, AttentionReason[]>>
): AttentionClassifications {
  return Object.fromEntries(
    attentionViewKeys.map((key) => {
      const reasons = views[key] ?? [];
      return [key, { key, member: reasons.length > 0, reasons }];
    })
  ) as AttentionClassifications;
}

describe('priority tiers', () => {
  it('places every known input in its documented tier', () => {
    const expected: [string, AttentionReason['source'], AttentionViewKey, number][] = [
      ['isMissing', 'catalog', 'attention', 1],
      ['unresolvedCollectorErrors', 'catalog', 'attention', 1],
      ['githubCiState', 'github', 'attention', 1],
      ['tdBlockedCount', 'td', 'attention', 1],
      ['githubOldestExternalPrAgeDays', 'github', 'attention', 2],
      ['tdStaleCount', 'td', 'attention', 2],
      ['stack.go.eolFrom', 'stack', 'upgrade', 2],
      ['stack.node.status', 'stack', 'upgrade', 2],
      ['stack.bun.cyclesBehind', 'stack', 'upgrade', 2],
      ['tech.jquery.ring', 'tech', 'upgrade', 2],
      ['tech.jquery.reviewAfter', 'tech', 'attention', 2],
      ['complete', 'decision', 'attention', 3]
    ];
    for (const [input, source, view, tier] of expected)
      expect(priorityTier(reason(input, source), view), input).toBe(tier);
  });

  it('gives an unknown input the tier of the view it came from', () => {
    expect(priorityTier(reason('somethingNew'), 'attention')).toBe(3);
    expect(priorityTier(reason('somethingNew'), 'upgrade')).toBe(3);
    expect(priorityTier(reason('somethingNew'), 'dormant')).toBe(4);
    expect(priorityTier(reason('somethingNew'), 'opportunity')).toBe(4);
    expect(priorityTier(reason('somethingNew'), 'quickwin')).toBe(4);
    expect(priorityTier(reason('somethingNew'), 'rising')).toBe(5);
    expect(priorityTier(reason('somethingNew'), 'momentum')).toBe(5);
  });
});

describe('selectPriority', () => {
  it('ranks by tier regardless of the order the classifier pushed reasons', () => {
    const selection = selectPriority(
      classified({
        attention: [
          reason('complete', 'decision'),
          reason('tdStaleCount', 'td'),
          reason('githubCiState', 'github')
        ]
      })
    );
    expect(selection.primary?.reason.input).toBe('githubCiState');
    expect(selection.others.map((item) => item.reason.input)).toEqual(['tdStaleCount', 'complete']);
  });

  it('breaks ties inside a tier by source, then by input', () => {
    const selection = selectPriority(
      classified({
        attention: [
          reason('tdBlockedCount', 'td'),
          reason('githubCiState', 'github'),
          reason('unresolvedCollectorErrors', 'catalog'),
          reason('isMissing', 'catalog')
        ]
      })
    );
    expect([selection.primary!, ...selection.others].map((item) => item.reason.input)).toEqual([
      'isMissing',
      'unresolvedCollectorErrors',
      'githubCiState',
      'tdBlockedCount'
    ]);
  });

  it('never leads with a positive or context signal', () => {
    const selection = selectPriority(
      classified({
        momentum: [reason('commits30d', 'git'), reason('activeDays30d', 'git')],
        rising: [reason('githubStarsGained30d', 'github')],
        dormant: [reason('latestCommitAgeDays', 'git')]
      })
    );
    expect(selection.primary).toBeNull();
    // Nothing is dropped: the calm state still knows every membership.
    expect(selection.others.map((item) => [item.tier, item.reason.input])).toEqual([
      [4, 'latestCommitAgeDays'],
      [5, 'githubStarsGained30d'],
      [5, 'activeDays30d'],
      [5, 'commits30d']
    ]);
  });

  it('collapses a reason shared by several views into one item at its highest tier', () => {
    const selection = selectPriority(
      classified({
        opportunity: [
          reason('commits30d', 'git', 'Only 5 commits in 30 days'),
          reason('githubExternalIssues30d', 'github', '2 external issue(s) arrived')
        ],
        rising: [reason('githubExternalIssues30d', 'github', '2 external issues opened')]
      })
    );
    const shared = selection.others.find((item) => item.reason.input === 'githubExternalIssues30d');
    expect(shared).toMatchObject({
      tier: 4,
      views: ['rising', 'opportunity'],
      reason: { message: '2 external issue(s) arrived' }
    });
    expect(selection.others).toHaveLength(2);
  });

  it('keeps a decision below a blocker and above context, and is stable across calls', () => {
    const input = classified({
      attention: [reason('complete', 'decision')],
      upgrade: [reason('tech.jquery.ring', 'tech')],
      quickwin: [reason('locCode', 'git')]
    });
    const first = selectPriority(input);
    expect(first.primary?.reason.input).toBe('tech.jquery.ring');
    expect(first.others.map((item) => item.reason.input)).toEqual(['complete', 'locCode']);
    expect(selectPriority(input)).toEqual(first);
  });

  it('has nothing to say for a kind the rules do not classify', () => {
    expect(selectPriority(null)).toEqual({ primary: null, others: [] });
    expect(selectPriority(classified({}))).toEqual({ primary: null, others: [] });
  });
});
