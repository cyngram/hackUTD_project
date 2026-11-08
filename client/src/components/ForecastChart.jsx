import { useRef, useState } from "react";
import { money } from "../lib/format";

// One color per path, from Figma's palette (blue, green, sand)
const COLORS = ["#5184a5", "#4e7b66", "#a77f49"];
export const colorFor = (index) => COLORS[index % COLORS.length];

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Month label for "m months from now": "Mar '27", or "March 2027" when long
function monthLabel(m, long = false) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + m);
  if (long) return d.toLocaleString("en-US", { month: "long", year: "numeric" });
  return `${SHORT_MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

// Compact axis money: 82195 -> "$82k", 4500 -> "$4.5k"
function shortMoney(n) {
  const abs = Math.abs(n);
  const text = abs >= 10000 ? `${Math.round(abs / 1000)}k` : abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : `${Math.round(abs)}`;
  return `${n < 0 ? "-" : ""}$${text}`;
}

// A smooth curve through the points (Catmull-Rom spline turned into SVG Bézier curves)
function smoothPath(points) {
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

// Draws "what you'd own" for every path. The selected path is solid with a soft fill; others are dashed.
export default function ForecastChart({ options, selectedId, months }) {
  const [hoverState, setHover] = useState(null);   // which month the mouse is over
  const hover = hoverState !== null && hoverState <= months ? hoverState : null;   // ignore months outside the current range
  const svgRef = useRef(null);

  const W = 640;
  const H = 260;
  const PAD = { left: 56, right: 76, top: 16, bottom: 28 };

  const series = options.map((o) => o.forecast.slice(0, months + 1));
  const values = series.flat().map((p) => p.net);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const pad = (hi - lo) * 0.08 || 1000;   // zoom to the data, with a little breathing room
  lo = Math.min(...values) >= 0 ? Math.max(0, lo - pad) : lo - pad;   // don't show a fake negative axis
  hi += pad;

  const x = (m) => PAD.left + (m / months) * (W - PAD.left - PAD.right);
  const y = (v) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

  const tickStep = months === 60 ? 12 : months === 24 ? 6 : 3;
  const xTicks = [];
  for (let m = 0; m <= months; m += tickStep) xTicks.push(m);
  const yTicks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3);

  const selectedIndex = Math.max(0, options.findIndex((o) => o.id === selectedId));
  const selectedSeries = series[selectedIndex];
  const end = selectedSeries[selectedSeries.length - 1];
  // Draw the selected path last so it sits on top
  const drawOrder = options.map((o, i) => i).sort((a, b) => (a === selectedIndex) - (b === selectedIndex));

  const onMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const m = Math.round(((svgX - PAD.left) / (W - PAD.left - PAD.right)) * months);
    setHover(Math.max(0, Math.min(months, m)));
  };

  return (
    <div className="forecast">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="What you'd own over time on each path"
      >
        {yTicks.map((v, i) => (
          <g key={i}>
            <line className="forecast-grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="forecast-label" x={PAD.left - 8} y={y(v) + 4} textAnchor="end">{shortMoney(v)}</text>
          </g>
        ))}
        {xTicks.map((m) => (
          <text key={m} className="forecast-label" x={x(m)} y={H - 6} textAnchor="middle">
            {m === 0 ? "Today" : monthLabel(m)}
          </text>
        ))}
        {lo < 0 && hi > 0 && (
          <line className="forecast-zero" x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />
        )}

        {drawOrder.map((i) => {
          const isSelected = i === selectedIndex;
          const d = smoothPath(series[i].map((p) => [x(p.month), y(p.net)]));
          return (
            <g key={options[i].id}>
              {isSelected && (
                <path d={`${d} L${x(months)},${H - PAD.bottom} L${x(0)},${H - PAD.bottom} Z`} fill={colorFor(i)} opacity="0.1" />
              )}
              <path
                d={d}
                fill="none"
                stroke={colorFor(i)}
                strokeWidth={isSelected ? 2.2 : 1.4}
                strokeDasharray={isSelected ? undefined : "5 4"}
                strokeLinecap="round"
                opacity={isSelected ? 1 : 0.85}
              />
            </g>
          );
        })}

        <circle cx={x(months)} cy={y(end.net)} r="3.5" fill={colorFor(selectedIndex)} />
        <rect x={x(months) + 8} y={y(end.net) - 12} width="64" height="24" rx="12" fill={colorFor(selectedIndex)} />
        <text x={x(months) + 40} y={y(end.net) + 4} textAnchor="middle" className="forecast-bubble">{shortMoney(end.net)}</text>

        {hover !== null && (
          <line className="forecast-hover" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} />
        )}
      </svg>

      {hover !== null && (
        <div className="forecast-tip" style={{ left: `${Math.min((x(hover) / W) * 100, 68)}%` }}>
          <strong>{hover === 0 ? "Today" : monthLabel(hover, true)}</strong>
          {selectedSeries[hover].events.map((e) => (
            <span key={e.label} className="tip-event">
              {e.label} {e.amount >= 0 ? "+" : "-"}{money(Math.abs(e.amount))}
            </span>
          ))}
          {options.map((o, i) => (
            <span key={o.id} className="tip-row">
              <i style={{ background: colorFor(i) }} />
              {o.label}: <b>{money(series[i][hover].net)}</b>
            </span>
          ))}
        </div>
      )}

      <div className="forecast-legend">
        {options.map((o, i) => (
          <span key={o.id}>
            <svg width="22" height="8" aria-hidden="true">
              <line
                x1="1" y1="4" x2="21" y2="4"
                stroke={colorFor(i)}
                strokeWidth={i === selectedIndex ? 2.2 : 1.4}
                strokeDasharray={i === selectedIndex ? undefined : "5 4"}
              />
            </svg>
            {o.label}{o.recommended ? " (our pick)" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
