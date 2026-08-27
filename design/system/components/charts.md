---
ste-prose: descriptive
---

# Data visualisation

Reference specifications for `components/charts/`. For each component: the **prop contract** (the API you must preserve), the **usage rules**, and the **reference implementation**.

> The implementations are inline-styled React because that is what the design-system tooling required. In the LUDWISE codebase these become `.astro` components with scoped styles, or React islands where the README's island table says so. Preserve every prop name, variant name and default. Do not copy the inline styles.

Components in this group: `PriceHistoryChart`.

---

## PriceHistoryChart

Plots what LUDWISE has actually observed, as a step chart with a visible marker per observation.

```jsx
<PriceHistoryChart
  currency="EUR"
  observedSince="4 May 2026"
  observedLow={24.99}
  series={[{ label: "Steam", points: observations }]}
  emptyMessage="LUDWISE started observing this game on 4 August 2026. A chart appears after seven observations."
/>
```

**WHEN** plotting price over time, **USE** a step line with a marker on every observation **BECAUSE** a smooth curve implies LUDWISE measured values between observations, which it did not. §29 of PRODUCT.md: charts reflect observations, not fabricated continuous values.

**WHEN** more than one store is shown, **USE** the built-in series styles **BECAUSE** each carries a distinct colour, dash pattern *and* marker shape — the chart must stay readable in greyscale and under every colour-vision deficiency.

- The lowest-observed rule is a dashed amber line with a text label. It is the only decorated element in the plot.
- No gradients, no area fills, no drop shadows, no animation on load.
- Y axis is padded, not zero-based, because price movement is the subject; the axis always carries currency-formatted labels so no number is ever bare.
- Every chart must be accompanied by the same data in a `DataTable`, or a link to it. The chart is not the only route to the numbers.

### Prop contract

```ts
import * as React from "react";

export interface PriceObservation {
  /** ISO date of the observation. */
  date: string;
  amount: number;
}

export interface PriceSeries {
  /** Store name. Becomes the legend entry and the accessible series name. */
  label: string;
  points: PriceObservation[];
}

export interface PriceHistoryChartProps {
  /** Up to 4 stores. Series 1 is drawn solid amber; each further series gets a
   *  distinct colour, dash pattern AND marker shape. */
  series: PriceSeries[];
  currency: string;
  locale?: string;
  /** Start of LUDWISE's observation window, e.g. "4 May 2026". Rendered in the
   *  caption. Required whenever the chart implies historical coverage. */
  observedSince?: string;
  /** Draws the dashed amber lowest-observed rule. */
  observedLow?: number;
  height?: number;
  /** Shown when every series is empty. Explain WHY there is no history. */
  emptyMessage?: string;
}

export declare function PriceHistoryChart(props: PriceHistoryChartProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { formatMoney } from "../game/Price.jsx";

const seriesStyleMap = [
  { color: "var(--ludwise-series-1)", dash: "none", marker: "circle" },
  { color: "var(--ludwise-series-2)", dash: "6 3", marker: "square" },
  { color: "var(--ludwise-series-3)", dash: "2 3", marker: "triangle" },
  { color: "var(--ludwise-series-4)", dash: "8 3 2 3", marker: "diamond" }
];

function marker(shape, x, y, color) {
  if (shape === "square") return <rect x={x - 3} y={y - 3} width={6} height={6} fill={color} />;
  if (shape === "triangle") return <polygon points={`${x},${y - 4} ${x + 4},${y + 3} ${x - 4},${y + 3}`} fill={color} />;
  if (shape === "diamond") return <polygon points={`${x},${y - 4} ${x + 4},${y} ${x},${y + 4} ${x - 4},${y}`} fill={color} />;
  return <circle cx={x} cy={y} r={3} fill={color} />;
}

export function PriceHistoryChart({
  series = [], currency = "EUR", locale, observedSince, height = 260,
  observedLow, emptyMessage, style
}) {
  const [hoverIndex, setHoverIndex] = React.useState(null);
  const W = 720, H = height, PL = 56, PR = 16, PT = 16, PB = 34;
  const points = series.flatMap(s => s.points || []);

  if (points.length === 0) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", minHeight: height,
        padding: "var(--space-6)", textAlign: "center", borderRadius: "var(--radius-card)",
        border: "var(--border-width-hairline) solid var(--color-border-default)",
        background: "var(--color-chart-nodata)", font: "var(--text-body-sm)", color: "var(--color-text-secondary)", ...style
      }}>{emptyMessage || "No price observations collected yet."}</div>
    );
  }

  const ts = points.map(p => new Date(p.date).getTime());
  const vs = points.map(p => p.amount);
  const minT = Math.min(...ts), maxT = Math.max(...ts) || minT + 1;
  const rawMin = Math.min(...vs), rawMax = Math.max(...vs);
  const pad = Math.max((rawMax - rawMin) * 0.15, rawMax * 0.05, 1);
  const minV = Math.max(0, rawMin - pad), maxV = rawMax + pad;

  const sx = t => PL + ((t - minT) / (maxT - minT || 1)) * (W - PL - PR);
  const sy = v => PT + (1 - (v - minV) / (maxV - minV || 1)) * (H - PT - PB);

  const yTicks = [minV, minV + (maxV - minV) / 2, maxV];
  const xTicks = [minT, minT + (maxT - minT) / 2, maxT];
  const fmtDate = t => new Date(t).toLocaleDateString(locale || undefined, { day: "numeric", month: "short" });

  const all = series[0] ? series[0].points : [];

  return (
    <figure style={{ margin: 0, ...style }}>
      <div style={{
        border: "var(--border-width-hairline) solid var(--color-border-default)",
        borderRadius: "var(--radius-card)", background: "var(--color-chart-plot)", padding: "var(--space-3)"
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
          aria-label={"Observed price history" + (observedSince ? " since " + observedSince : "")}
          style={{ display: "block", overflow: "visible" }}>
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={PL} x2={W - PR} y1={sy(v)} y2={sy(v)} stroke="var(--color-chart-grid)" strokeWidth="1" />
              <text x={PL - 8} y={sy(v) + 4} textAnchor="end" fill="var(--color-chart-label)"
                style={{ font: "var(--text-caption)", fontVariantNumeric: "tabular-nums" }}>
                {formatMoney(v, currency, locale)}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text key={i} x={sx(t)} y={H - PB + 20} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
              fill="var(--color-chart-label)" style={{ font: "var(--text-caption)" }}>{fmtDate(t)}</text>
          ))}
          <line x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} stroke="var(--color-chart-axis)" strokeWidth="1" />

          {series.map((s, si) => {
            const st = seriesStyleMap[si % seriesStyleMap.length];
            const pts = (s.points || []).map(p => [sx(new Date(p.date).getTime()), sy(p.amount)]);
            let d = "";
            pts.forEach((p, i) => {
              if (i === 0) d += `M${p[0]},${p[1]}`;
              else d += ` L${p[0]},${pts[i - 1][1]} L${p[0]},${p[1]}`;
            });
            return (
              <g key={s.label}>
                <path d={d} fill="none" stroke={st.color} strokeWidth="2"
                  strokeDasharray={st.dash === "none" ? undefined : st.dash} strokeLinejoin="round" />
                {pts.map((p, i) => <g key={i}>{marker(st.marker, p[0], p[1], st.color)}</g>)}
              </g>
            );
          })}

          {observedLow != null && (
            <g>
              <line x1={PL} x2={W - PR} y1={sy(observedLow)} y2={sy(observedLow)}
                stroke="var(--color-accent-primary)" strokeWidth="1.5" strokeDasharray="3 3" />
              <text x={W - PR} y={sy(observedLow) - 6} textAnchor="end" fill="var(--color-accent-text)"
                style={{ font: "var(--text-label-sm)", letterSpacing: "var(--letter-spacing-label)" }}>
                {"Lowest observed " + formatMoney(observedLow, currency, locale)}
              </text>
            </g>
          )}

          {all.map((p, i) => (
            <rect key={i} x={sx(new Date(p.date).getTime()) - 10} y={PT} width={20} height={H - PT - PB}
              fill="transparent" onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)} />
          ))}
          {hoverIndex != null && all[hoverIndex] && (
            <line x1={sx(new Date(all[hoverIndex].date).getTime())} x2={sx(new Date(all[hoverIndex].date).getTime())}
              y1={PT} y2={H - PB} stroke="var(--color-chart-axis)" strokeWidth="1" />
          )}
        </svg>
      </div>

      <figcaption style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
          {series.map((s, si) => {
            const st = seriesStyleMap[si % seriesStyleMap.length];
            return (
              <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", font: "var(--text-caption)", color: "var(--color-text-secondary)" }}>
                <svg width="24" height="10" aria-hidden="true">
                  <line x1="0" y1="5" x2="24" y2="5" stroke={st.color} strokeWidth="2" strokeDasharray={st.dash === "none" ? undefined : st.dash} />
                  {marker(st.marker, 12, 5, st.color)}
                </svg>
                {s.label}
              </span>
            );
          })}
        </div>
        {observedSince && (
          <span style={{ font: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
            {"Observed by LUDWISE since " + observedSince}
          </span>
        )}
      </figcaption>

      {hoverIndex != null && all[hoverIndex] && (
        <p className="lw-tabular" style={{ marginTop: "var(--space-2)", font: "var(--text-body-sm)", color: "var(--color-text-primary)" }}>
          {new Date(all[hoverIndex].date).toLocaleDateString(locale || undefined, { day: "numeric", month: "short", year: "numeric" })}
          {" \u00b7 " + formatMoney(all[hoverIndex].amount, currency, locale)}
        </p>
      )}
    </figure>
  );
}
```

---

