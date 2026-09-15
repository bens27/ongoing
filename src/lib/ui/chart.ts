import type { EntryHistory, HistoryObservation } from '$lib/domain/entry-history';
import { shortDate, wholeNumber } from './format';

/**
 * Dated-chart geometry and copy. Components own layout, focus, and disclosure; this module
 * decides where each observation sits, which segments are interpolations, and how the series
 * is described in text. Coordinates are the mockup's 440×120 viewBox; tests pin them.
 */
export const CHART_LAYOUT = {
  width: 440,
  height: 120,
  left: 8,
  right: 432,
  top: 19,
  bottom: 105
} as const;

const PLOT_WIDTH = CHART_LAYOUT.right - CHART_LAYOUT.left;
const PLOT_HEIGHT = CHART_LAYOUT.bottom - CHART_LAYOUT.top;
export const CHART_MID_Y = (CHART_LAYOUT.top + CHART_LAYOUT.bottom) / 2;
const DAY = 86_400_000;
/** A gap of this many calendar days (or more) is labelled and marks the series as sparse. */
export const SPARSE_GAP_DAYS = 7;

export interface ChartPoint {
  capturedOn: string;
  value: number;
  x: number;
  y: number;
  readout: string;
  label: string;
}

export interface ChartSegment {
  from: ChartPoint;
  to: ChartPoint;
  /** True when the points are more than one calendar day apart — interpolation, not capture. */
  interpolated: boolean;
  d: string;
}

export interface ChartGap {
  from: string;
  to: string;
  days: number;
}

export interface ChartTick {
  value: number;
  y: number;
  label: string;
}

export type ShapedChart =
  | {
      state: 'unavailable';
      summary: string;
      reason: string;
      plotted: [];
    }
  | {
      state: 'empty';
      summary: string;
      plotted: [];
      omittedDates: number;
    }
  | {
      state: 'single' | 'constant' | 'series';
      summary: string;
      rangeLabel: string;
      startsAtZero: boolean;
      sparse: boolean;
      plotted: ChartPoint[];
      segments: ChartSegment[];
      gaps: ChartGap[];
      unknowns: string[];
      ticks: ChartTick[];
      gridY: readonly number[];
      xLabels: { from: string; to: string };
      omittedDates: number;
      domain: { min: number; max: number; from: string; to: string };
      notice: string | null;
    };

export function calendarDays(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / DAY;
}

function xAt(from: string, to: string, on: string): number {
  if (from === to) return (CHART_LAYOUT.left + CHART_LAYOUT.right) / 2;
  return CHART_LAYOUT.left + (calendarDays(from, on) / calendarDays(from, to)) * PLOT_WIDTH;
}

function yAt(min: number, max: number, value: number): number {
  if (min === max) return min === 0 ? CHART_LAYOUT.bottom : CHART_MID_Y;
  return CHART_LAYOUT.bottom - ((value - min) / (max - min)) * PLOT_HEIGHT;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function listNumbers(values: number[]): string {
  if (values.length === 1) return String(values[0]);
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function buildSummary(input: {
  state: 'single' | 'constant' | 'series';
  unit: string;
  plotted: ChartPoint[];
  min: number;
  max: number;
  from: string;
  to: string;
  sparse: boolean;
  gaps: ChartGap[];
  unknowns: string[];
  omittedDates: number;
  notice: string | null;
}): string {
  const parts: string[] = [];
  if (input.state === 'single') {
    parts.push(
      `One observation on ${shortDate(input.from)}: ${wholeNumber(input.min)} ${input.unit}.`
    );
  } else if (input.state === 'constant') {
    parts.push(
      `Constant ${wholeNumber(input.min)} ${input.unit} across ${input.plotted.length} observations from ${shortDate(input.from)} to ${shortDate(input.to)}.`
    );
  } else {
    parts.push(
      `${capitalize(input.unit)} from ${wholeNumber(input.min)} to ${wholeNumber(input.max)} between ${shortDate(input.from)} and ${shortDate(input.to)}; ${input.plotted.length} observations.`
    );
  }
  if (input.sparse && input.state !== 'single') {
    parts.push('Sparse samples; connecting lines interpolate between observations.');
  }
  const notable = input.gaps.filter((gap) => gap.days >= SPARSE_GAP_DAYS).map((gap) => gap.days);
  if (notable.length === 1) parts.push(`Gap of ${notable[0]} days.`);
  else if (notable.length > 1) parts.push(`Gaps of ${listNumbers(notable)} days.`);
  if (input.unknowns.length === 1) parts.push('1 observation has an unknown value.');
  else if (input.unknowns.length > 1)
    parts.push(`${input.unknowns.length} observations have unknown values.`);
  if (input.omittedDates === 1) parts.push('1 observation omitted: missing or invalid date.');
  else if (input.omittedDates > 1)
    parts.push(`${input.omittedDates} observations omitted: missing or invalid dates.`);
  if (input.notice) parts.push(input.notice);
  return parts.join(' ');
}

/**
 * Place dated observations on the chart, detect gaps, and write the text summary. Null values
 * break the line rather than becoming zeros; missing dates are already omitted by the history
 * read and are never invented here. The x-axis is the observed date range, not the requested
 * window, so two samples a week apart are not stretched across ninety days.
 */
export function shapeHistoryChart(
  history: Pick<EntryHistory, 'observations' | 'availability' | 'omittedDates'>,
  options: { unit: string }
): ShapedChart {
  const { unit } = options;
  const omittedDates = history.omittedDates;
  const unknowns = history.observations
    .filter((point) => point.value === null)
    .map((point) => point.capturedOn);
  const numeric = history.observations.filter(
    (point): point is HistoryObservation & { value: number } => point.value !== null
  );

  if (history.availability.state === 'unavailable' && numeric.length === 0) {
    const reason = history.availability.reason ?? 'the provider did not answer';
    return {
      state: 'unavailable',
      reason,
      summary: `${capitalize(unit)} were not collected: ${reason}.`,
      plotted: []
    };
  }

  if (numeric.length === 0) {
    return {
      state: 'empty',
      summary: `No dated ${unit} observations in this window.`,
      plotted: [],
      omittedDates
    };
  }

  const values = numeric.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const from = numeric[0].capturedOn;
  const to = numeric.at(-1)!.capturedOn;
  const startsAtZero = min === 0;
  const constant = min === max;
  const state = numeric.length === 1 ? 'single' : constant ? 'constant' : 'series';

  const plotted: ChartPoint[] = numeric.map((point) => {
    const readout = `${shortDate(point.capturedOn)}: ${wholeNumber(point.value)} ${unit}`;
    return {
      capturedOn: point.capturedOn,
      value: point.value,
      x: xAt(from, to, point.capturedOn),
      y: yAt(min, max, point.value),
      readout,
      label: readout
    };
  });

  const plottedByDate = new Map(plotted.map((point) => [point.capturedOn, point]));
  const gaps: ChartGap[] = [];
  const segments: ChartSegment[] = [];
  // Walk stored observations, not the plotted subset: a null is a known capture with an unknown
  // value and must break the line. Missing dates (already omitted) remain interpolations.
  for (let i = 1; i < history.observations.length; i++) {
    const previous = plottedByDate.get(history.observations[i - 1].capturedOn);
    const next = plottedByDate.get(history.observations[i].capturedOn);
    if (!previous || !next) continue;
    const days = calendarDays(previous.capturedOn, next.capturedOn);
    const interpolated = days > 1;
    if (interpolated) gaps.push({ from: previous.capturedOn, to: next.capturedOn, days });
    segments.push({
      from: previous,
      to: next,
      interpolated,
      d: `M${previous.x},${previous.y} L${next.x},${next.y}`
    });
  }

  const sparse = state === 'single' || gaps.some((gap) => gap.days >= SPARSE_GAP_DAYS);
  const ticks: ChartTick[] = constant
    ? [{ value: min, y: yAt(min, max, min), label: wholeNumber(min) }]
    : [max, (min + max) / 2, min].map((value) => ({
        value,
        y: yAt(min, max, value),
        label: wholeNumber(value)
      }));

  const rangeLabel = constant
    ? `Constant ${wholeNumber(min)}`
    : startsAtZero
      ? `Range ${wholeNumber(min)}–${wholeNumber(max)}`
      : `Range ${wholeNumber(min)}–${wholeNumber(max)} · axis does not start at 0`;

  const notice =
    history.availability.state === 'unavailable'
      ? `${history.availability.provider} is unavailable; showing retained observations.`
      : null;

  return {
    state,
    summary: buildSummary({
      state,
      unit,
      plotted,
      min,
      max,
      from,
      to,
      sparse,
      gaps,
      unknowns,
      omittedDates,
      notice
    }),
    rangeLabel,
    startsAtZero,
    sparse,
    plotted,
    segments,
    gaps,
    unknowns,
    ticks,
    gridY: [CHART_LAYOUT.top, CHART_MID_Y, CHART_LAYOUT.bottom],
    xLabels: { from: shortDate(from), to: shortDate(to) },
    omittedDates,
    domain: { min, max, from, to },
    notice
  };
}
