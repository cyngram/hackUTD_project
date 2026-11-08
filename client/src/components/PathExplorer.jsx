import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Bot, CheckCircle2, X } from "lucide-react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import ForecastChart from "./ForecastChart";

// The what-if sliders. To add one, add a line here (and accept the key in the backend).
const WHAT_IFS = [
  { key: "gasPrice", label: "Gas price", min: 2, max: 6, step: 0.1, show: (v) => `$${v.toFixed(2)}/gal` },
  { key: "incomeGapMonths", label: "Months without income", min: 0, max: 6, step: 1, show: (v) => `${v} mo` },
  { key: "surpriseRepair", label: "One-time expense (repair or treat)", min: 0, max: 5000, step: 100, show: (v) => money(v) },
];

export default function PathExplorer({ customerId, comingUp, treat, onClose, onAskCosmo }) {
  // Only send what the user changed; the backend fills in its own defaults
  const [whatIfs, setWhatIfs] = useState(treat?.amount ? { surpriseRepair: treat.amount } : {});
  const [sim, setSim] = useState(null);
  const [error, setError] = useState("");

  // Re-run the simulator whenever a slider changes (waits 250 ms so dragging doesn't flood the server)
  useEffect(() => {
    let stale = false;
    const timer = setTimeout(() => {
      api("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, assumptions: whatIfs }),
      })
        .then((data) => !stale && setSim(data))
        .catch((e) => !stale && setError(e.message));
    }, 250);
    return () => { stale = true; clearTimeout(timer); };
  }, [customerId, whatIfs]);

  const stressOn = (sim?.assumptions.incomeGapMonths ?? 0) > 0 || (sim?.assumptions.surpriseRepair ?? 0) > 0;

  return (
    <div className="overlay" role="presentation" onMouseDown={onClose}>
      <aside
        className="detail-panel path-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paths-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          <button className="back-button" onClick={onClose}>
            <ArrowLeft size={18} /> Dashboard
          </button>
          <button className="icon-button" onClick={onClose} aria-label="Close paths">
            <X size={20} />
          </button>
        </div>

        <p className="eyebrow">{comingUp?.when ?? "Your paths"}</p>
        <h2 id="paths-title">{comingUp?.title ?? "Where do you want to go?"}</h2>
        {treat?.amount > 0 && (
          <p className="panel-subheading">
            Showing {treat.label.toLowerCase()} ({money(treat.amount)}) as a one-time expense.
          </p>
        )}

        {!sim ? (
          <p className="panel-subheading">{error || "Mapping your paths…"}</p>
        ) : (
          <>
            <div className="path-grid">
              {sim.options.map((o) => (
                <article key={o.id} className={`path-card ${o.recommended ? "recommended" : ""}`}>
                  {o.recommended && <span className="pick-badge">Our pick</span>}
                  <h3>{o.label}</h3>
                  <p className="path-monthly">{money(o.monthly.totalCar)}<span>/mo</span></p>
                  <p className="path-meta">5-year true cost {money(o.fiveYear.netCost)}</p>
                  <p className="path-why">{o.why}</p>
                  {o.perk && <p className="path-perk">{o.perk}</p>}
                  {stressOn && (
                    <p className={o.stress.holdsUp ? "path-ok" : "path-warn"}>
                      {o.stress.holdsUp ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                      {o.stress.holdsUp
                        ? `Holds up: ${money(o.stress.savingsAfter)} left`
                        : `Savings run out (${money(o.stress.savingsAfter)})`}
                    </p>
                  )}
                </article>
              ))}
            </div>

            <section className="panel-block">
              <p className="eyebrow">What you'd own over the next 2 years (savings + car value − loan)</p>
              <ForecastChart options={sim.options} />
            </section>

            <section className="panel-block">
              <p className="eyebrow">What if…</p>
              {WHAT_IFS.map((w) => {
                const value = whatIfs[w.key] ?? sim.assumptions[w.key];   // follow your finger immediately
                return (
                  <label className="what-if" key={w.key}>
                    <span>{w.label}</span>
                    <input
                      type="range"
                      min={w.min}
                      max={w.max}
                      step={w.step}
                      value={value}
                      onChange={(e) => setWhatIfs((prev) => ({ ...prev, [w.key]: Number(e.target.value) }))}
                    />
                    <output>{w.show(value)}</output>
                  </label>
                );
              })}
            </section>

            <section className="next-step">
              <CheckCircle2 size={22} />
              <div>
                <strong>{sim.recommendation.headline}</strong>
                <p>Next step: {sim.recommendation.nextStep}</p>
              </div>
              <button className="primary-button" onClick={onAskCosmo}>
                <Bot size={18} /> Ask Cosmo
              </button>
            </section>
          </>
        )}
      </aside>
    </div>
  );
}
