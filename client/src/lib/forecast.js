// Helpers for forecast data ({ month, net, savings } points), shared by any chart or summary.

// Bucketed data (e.g. quarters from Tiger's time_bucket) has gaps between points.
// Fill every month in between with a straight line so charts can read point N as month N.
export function fillMonths(points, lastMonth = 60) {
  if (points.length < 2 || points.length > lastMonth) return points;   // already monthly (or nothing to fill)
  const out = [];
  let i = 0;
  for (let m = 0; m <= lastMonth; m++) {
    while (i < points.length - 2 && points[i + 1].month <= m) i++;   // the two points around this month
    const a = points[i], b = points[i + 1];
    const t = Math.min(1, (m - a.month) / (b.month - a.month));
    const between = (key) => Math.round(a[key] + (b[key] - a[key]) * t);
    out.push({ month: m, net: between("net"), savings: between("savings") });
  }
  return out;
}

// How far apart two paths are at a few points in time: [{ years, amount, ahead }]
export function gapsBetween(a, b, months = [12, 36, 60]) {
  return months.map((m) => {
    const diff = a.forecast[m].net - b.forecast[m].net;
    return { years: m / 12, amount: Math.abs(diff), ahead: diff >= 0 ? a.label : b.label };
  });
}
