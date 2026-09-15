<script lang="ts">
  import { CHART_LAYOUT, type ShapedChart } from '../chart';

  /**
   * One dated series: points spaced by observation date, a single Tab stop, arrow keys between
   * points. Connecting segments that skip days are drawn dashed — interpolation, not capture.
   */
  let {
    chart,
    reducedMotion = false
  }: {
    chart: Extract<ShapedChart, { state: 'single' | 'constant' | 'series' }>;
    reducedMotion?: boolean;
  } = $props();

  let active = $state(0);
  let hovered = $state<number | null>(null);

  let focused = $derived(Math.min(active, chart.plotted.length - 1));
  let shown = $derived(hovered ?? focused);
  let readout = $derived(
    chart.plotted[shown]?.readout ?? 'Dated snapshots · hover, or focus and use ← →'
  );

  function select(index: number) {
    if (index < 0 || index >= chart.plotted.length) return;
    active = index;
  }

  let svg = $state<SVGSVGElement | null>(null);

  function onkeydown(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const last = chart.plotted.length - 1;
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? last
          : event.key === 'ArrowRight'
            ? (focused + 1) % chart.plotted.length
            : (focused + last) % chart.plotted.length;
    select(next);
    svg?.querySelector<SVGElement>(`[data-point-index="${next}"]`)?.focus();
  }
</script>

<div class="chart" data-motion={reducedMotion ? 'reduce' : 'full'}>
  <svg
    class="spark"
    viewBox={`0 0 ${CHART_LAYOUT.width} ${CHART_LAYOUT.height}`}
    role="group"
    aria-label={chart.summary}
    bind:this={svg}
  >
    <path
      class="chart-grid"
      d={chart.gridY.map((y) => `M${CHART_LAYOUT.left} ${y}H${CHART_LAYOUT.right}`).join(' ')}
    />
    {#each chart.segments as segment (`${segment.from.capturedOn}:${segment.to.capturedOn}`)}
      <path class="chart-path" class:interpolated={segment.interpolated} d={segment.d} />
    {/each}
    {#each chart.plotted as point, index (point.capturedOn)}
      <g
        class="chart-point"
        role="button"
        aria-label={point.label}
        tabindex={index === focused ? 0 : -1}
        data-point={point.capturedOn}
        data-point-index={index}
        onfocus={() => select(index)}
        {onkeydown}
        onmouseenter={() => (hovered = index)}
        onmouseleave={() => (hovered = null)}
      >
        <circle class="hit" cx={point.x} cy={point.y} r="7" />
        <circle
          class="chart-dot"
          class:active={index === shown}
          cx={point.x}
          cy={point.y}
          r={index === shown && !reducedMotion ? 3 : 2}
        />
        <title>{point.label}</title>
      </g>
    {/each}
  </svg>
  <div class="chart-labels">
    <span>{chart.xLabels.from}</span>
    <span>{chart.rangeLabel}</span>
    <span>{chart.xLabels.to}</span>
  </div>
  {#if chart.notice}
    <p class="notice">{chart.notice}</p>
  {/if}
  <p class="readout" aria-live="polite">{readout}</p>
</div>

<style>
  .chart {
    color: var(--text-primary);
  }

  .spark {
    display: block;
    width: 100%;
    height: var(--chart-height);
    overflow: visible;
  }

  .chart-grid {
    fill: none;
    stroke: var(--border-default);
    stroke-width: var(--rule);
    stroke-dasharray: 2 5;
  }

  .chart-path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }

  .chart-path.interpolated {
    stroke-dasharray: 4 4;
  }

  .hit {
    fill: transparent;
  }

  .chart-dot {
    fill: currentColor;
  }

  .chart-dot.active {
    fill: var(--accent);
  }

  .chart-point:focus {
    outline: none;
  }

  .chart-point:focus-visible .hit {
    stroke: var(--accent);
    stroke-width: var(--rule-strong);
  }

  .chart-labels {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    margin-top: var(--space-1);
    color: var(--text-secondary);
    font-size: var(--text-2xs);
  }

  .notice,
  .readout {
    margin: var(--space-1) 0 0;
    color: var(--text-secondary);
    font-size: var(--text-2xs);
  }
</style>
