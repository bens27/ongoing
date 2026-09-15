import { describe, expect, it } from 'vitest';
import type { EntryHistory } from '$lib/domain/entry-history';
import {
  calendarDays,
  CHART_LAYOUT,
  CHART_MID_Y,
  shapeHistoryChart,
  SPARSE_GAP_DAYS
} from './chart';

const available: EntryHistory['availability'] = {
  state: 'available',
  provider: 'github',
  providerStatus: 'available',
  reason: null
};

function history(
  observations: EntryHistory['observations'],
  extra: Partial<Pick<EntryHistory, 'availability' | 'omittedDates'>> = {}
) {
  return {
    observations,
    availability: extra.availability ?? available,
    omittedDates: extra.omittedDates ?? 0
  };
}

describe('shapeHistoryChart', () => {
  it('spaces two points by date on the 440×120 viewBox and labels a non-zero axis', () => {
    // Independently: Jul 1 → Sep 1 is 62 days; Aug 1 is day 31, so x = 8 + 31/62 × 424 = 220.
    // Values 100 and 200 map to the plot bottom (105) and top (19); the midpoint 150 sits at y=62.
    const chart = shapeHistoryChart(
      history([
        { capturedOn: '2026-07-01', value: 100 },
        { capturedOn: '2026-08-01', value: 150 },
        { capturedOn: '2026-09-01', value: 200 }
      ]),
      { unit: 'stars' }
    );
    expect(chart.state).toBe('series');
    if (chart.state !== 'series') return;
    expect(calendarDays('2026-07-01', '2026-09-01')).toBe(62);
    expect(calendarDays('2026-07-01', '2026-08-01')).toBe(31);
    expect(chart.plotted.map((point) => [point.x, point.y])).toEqual([
      [8, 105],
      [220, 62],
      [432, 19]
    ]);
    expect(chart.startsAtZero).toBe(false);
    expect(chart.rangeLabel).toBe('Range 100–200 · axis does not start at 0');
    expect(chart.ticks).toEqual([
      { value: 200, y: 19, label: '200' },
      { value: 150, y: 62, label: '150' },
      { value: 100, y: 105, label: '100' }
    ]);
    expect(chart.gridY).toEqual([CHART_LAYOUT.top, CHART_MID_Y, CHART_LAYOUT.bottom]);
    expect(chart.xLabels).toEqual({ from: 'Jul 1', to: 'Sep 1' });
    expect(chart.segments.map((segment) => segment.interpolated)).toEqual([true, true]);
    expect(chart.gaps).toEqual([
      { from: '2026-07-01', to: '2026-08-01', days: 31 },
      { from: '2026-08-01', to: '2026-09-01', days: 31 }
    ]);
    expect(chart.sparse).toBe(true);
    expect(chart.summary).toBe(
      'Stars from 100 to 200 between Jul 1 and Sep 1; 3 observations. Sparse samples; connecting lines interpolate between observations. Gaps of 31 and 31 days.'
    );
  });

  it('starts the axis at zero when a zero is observed, and keeps adjacent days solid', () => {
    const chart = shapeHistoryChart(
      history([
        { capturedOn: '2026-09-01', value: 0 },
        { capturedOn: '2026-09-02', value: 50 },
        { capturedOn: '2026-09-03', value: 100 }
      ]),
      { unit: 'stars' }
    );
    expect(chart.state).toBe('series');
    if (chart.state !== 'series') return;
    expect(chart.startsAtZero).toBe(true);
    expect(chart.rangeLabel).toBe('Range 0–100');
    expect(chart.plotted.map((point) => point.y)).toEqual([105, 62, 19]);
    expect(chart.segments.every((segment) => !segment.interpolated)).toBe(true);
    expect(chart.gaps).toEqual([]);
    expect(chart.sparse).toBe(false);
    expect(SPARSE_GAP_DAYS).toBe(7);
    expect(chart.summary).toBe('Stars from 0 to 100 between Sep 1 and Sep 3; 3 observations.');
  });

  it('places a single observation in the middle and describes it as one sample', () => {
    const chart = shapeHistoryChart(history([{ capturedOn: '2026-09-13', value: 120 }]), {
      unit: 'stars'
    });
    expect(chart).toMatchObject({
      state: 'single',
      startsAtZero: false,
      sparse: true,
      plotted: [{ capturedOn: '2026-09-13', value: 120, x: 220, y: 62 }],
      segments: [],
      gaps: [],
      rangeLabel: 'Constant 120',
      summary: 'One observation on Sep 13: 120 stars.'
    });
  });

  it('places a lone zero on the baseline rather than floating it mid-axis', () => {
    const chart = shapeHistoryChart(history([{ capturedOn: '2026-09-13', value: 0 }]), {
      unit: 'stars'
    });
    expect(chart).toMatchObject({
      state: 'single',
      startsAtZero: true,
      plotted: [{ value: 0, x: 220, y: 105 }],
      rangeLabel: 'Constant 0',
      summary: 'One observation on Sep 13: 0 stars.'
    });
  });

  it('keeps a constant series on the mid line without inventing a zero', () => {
    const chart = shapeHistoryChart(
      history([
        { capturedOn: '2026-07-01', value: 50 },
        { capturedOn: '2026-08-01', value: 50 },
        { capturedOn: '2026-09-01', value: 50 }
      ]),
      { unit: 'stars' }
    );
    expect(chart.state).toBe('constant');
    if (chart.state !== 'constant') return;
    expect(chart.plotted.every((point) => point.y === 62)).toBe(true);
    expect(chart.plotted.map((point) => point.x)).toEqual([8, 220, 432]);
    expect(chart.ticks).toEqual([{ value: 50, y: 62, label: '50' }]);
    expect(chart.rangeLabel).toBe('Constant 50');
    expect(chart.summary).toBe(
      'Constant 50 stars across 3 observations from Jul 1 to Sep 1. Sparse samples; connecting lines interpolate between observations. Gaps of 31 and 31 days.'
    );
  });

  it('does not draw through a null, and never treats the null as zero', () => {
    const chart = shapeHistoryChart(
      history([
        { capturedOn: '2026-07-01', value: 100 },
        { capturedOn: '2026-08-01', value: null },
        { capturedOn: '2026-09-01', value: 200 }
      ]),
      { unit: 'stars' }
    );
    expect(chart.state).toBe('series');
    if (chart.state !== 'series') return;
    expect(chart.plotted.map((point) => point.value)).toEqual([100, 200]);
    expect(chart.unknowns).toEqual(['2026-08-01']);
    expect(chart.segments).toEqual([]);
    expect(chart.gaps).toEqual([]);
    expect(chart.summary).toBe(
      'Stars from 100 to 200 between Jul 1 and Sep 1; 2 observations. 1 observation has an unknown value.'
    );
  });

  it('does not pad missing dates; a 14-day span is one labelled interpolated gap', () => {
    const chart = shapeHistoryChart(
      history([
        { capturedOn: '2026-09-01', value: 10 },
        { capturedOn: '2026-09-15', value: 20 }
      ]),
      { unit: 'stars' }
    );
    expect(chart.state).toBe('series');
    if (chart.state !== 'series') return;
    expect(chart.plotted).toHaveLength(2);
    expect(chart.gaps).toEqual([{ from: '2026-09-01', to: '2026-09-15', days: 14 }]);
    expect(chart.segments).toEqual([
      expect.objectContaining({ interpolated: true, d: 'M8,105 L432,19' })
    ]);
    expect(chart.summary).toContain('Gap of 14 days.');
  });

  it('distinguishes an empty window from an unavailable provider, with no decorative points', () => {
    expect(shapeHistoryChart(history([]), { unit: 'stars' })).toEqual({
      state: 'empty',
      summary: 'No dated stars observations in this window.',
      plotted: [],
      omittedDates: 0
    });
    expect(
      shapeHistoryChart(
        history([], {
          availability: {
            state: 'unavailable',
            provider: 'loc',
            providerStatus: 'unknown',
            reason: 'loc provider status: unknown'
          }
        }),
        { unit: 'lines of code' }
      )
    ).toEqual({
      state: 'unavailable',
      reason: 'loc provider status: unknown',
      summary: 'Lines of code were not collected: loc provider status: unknown.',
      plotted: []
    });
  });

  it('still plots retained observations when the provider later becomes unavailable', () => {
    const chart = shapeHistoryChart(
      history(
        [
          { capturedOn: '2026-09-01', value: 10 },
          { capturedOn: '2026-09-02', value: 12 }
        ],
        {
          availability: {
            state: 'unavailable',
            provider: 'github',
            providerStatus: 'unavailable',
            reason: 'GitHub credentials unavailable'
          }
        }
      ),
      { unit: 'stars' }
    );
    expect(chart.state).toBe('series');
    if (chart.state !== 'series') return;
    expect(chart.plotted).toHaveLength(2);
    expect(chart.notice).toBe('github is unavailable; showing retained observations.');
    expect(chart.summary).toContain('github is unavailable; showing retained observations.');
  });

  it('mentions omitted invalid dates and several unknown values without inventing points', () => {
    const chart = shapeHistoryChart(
      history(
        [
          { capturedOn: '2026-09-01', value: 4_800 },
          { capturedOn: '2026-09-08', value: null },
          { capturedOn: '2026-09-10', value: null },
          { capturedOn: '2026-09-15', value: 4_812 }
        ],
        { omittedDates: 2 }
      ),
      { unit: 'lines of code' }
    );
    expect(chart.state).toBe('series');
    if (chart.state !== 'series') return;
    expect(chart.plotted.map((point) => point.value)).toEqual([4800, 4812]);
    expect(chart.unknowns).toEqual(['2026-09-08', '2026-09-10']);
    expect(chart.startsAtZero).toBe(false);
    expect(chart.rangeLabel).toBe('Range 4,800–4,812 · axis does not start at 0');
    expect(chart.segments).toEqual([]);
    expect(chart.gaps).toEqual([]);
    expect(chart.summary).toBe(
      'Lines of code from 4,800 to 4,812 between Sep 1 and Sep 15; 2 observations. 2 observations have unknown values. 2 observations omitted: missing or invalid dates.'
    );
  });
});
