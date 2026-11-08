import { money } from "../lib/format";

// One clearly different color per path (readable in light and dark mode)
const COLORS = ["#3b82c4", "#e07b39", "#8b5cf6"];

// Draws each path's savings forecast as a line. Plain SVG, so no chart library needed.
export default function ForecastChart({ options, months = 24 }) {
  const W = 640;
  const H = 220;
  const PAD = { left: 64, right: 12, top: 12, bottom: 28 };

  const series = options.map((o) => o.forecast.slice(0, months + 1));
  const balances = series.flat().map((point) => point.net);   // "what you'd own"
  const min = Math.min(0, ...balances);          // include $0 so dips below zero are visible
  const max = Math.max(...balances);

  // Convert a month / dollar amount into an x / y position on the chart
  const x = (month) => PAD.left + (month / months) * (W - PAD.left - PAD.right);
  const y = (value) => PAD.top + (1 - (value - min) / (max - min || 1)) * (H - PAD.top - PAD.bottom);

  return (
    <figure className="forecast">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Savings forecast for each path">
        {[min, (min + max) / 2, max].map((tick, i) => (
          <g key={i}>
            <line className="forecast-grid" x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
            <text className="forecast-label" x={PAD.left - 8} y={y(tick) + 4} textAnchor="end">
              {money(tick)}
            </text>
          </g>
        ))}
        {min < 0 && (
          <line className="forecast-zero" x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />
        )}
        {series.map((points, i) => (
          <polyline
            key={options[i].id}
            fill="none"
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={options[i].recommended ? 4.5 : 3}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={points.map((p) => `${x(p.month)},${y(p.net)}`).join(" ")}
          />
        ))}
        <text className="forecast-label" x={PAD.left} y={H - 6}>Today</text>
        <text className="forecast-label" x={W - PAD.right} y={H - 6} textAnchor="end">
          {months} months
        </text>
      </svg>
      <figcaption className="forecast-legend">
        {options.map((o, i) => (
          <span key={o.id}>
            <i style={{ background: COLORS[i % COLORS.length] }} />
            {o.label}{o.recommended ? " (our pick)" : ""}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
