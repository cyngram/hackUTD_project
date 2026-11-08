import { useEffect, useState } from "react";
import { Bot, X } from "lucide-react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import ForecastChart from "./ForecastChart";

// Month-by-month budget for the next 12 months: income vs spending, and where the money goes.
export default function BudgetPanel({ customerId, onClose, onAsk }) {
  const [budget, setBudget] = useState(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(0);

  useEffect(() => {
    api(`/api/customers/${customerId}/budget`).then(setBudget).catch((e) => setError(e.message));
  }, [customerId]);

  const month = budget?.months[picked];
  const tightMonths = budget?.months.filter((m) => m.leftover < 0) ?? [];

  // Shape it like simulator paths so the same chart can draw it
  const series = budget
    ? [
        { id: "spending", label: "Spending", forecast: budget.months.map((m) => ({ month: m.month, net: m.spending, events: m.events })) },
        { id: "income", label: "Income", forecast: budget.months.map((m) => ({ month: m.month, net: m.income, events: [] })) },
      ]
    : [];

  return (
    <div className="overlay" role="presentation" onMouseDown={onClose}>
      <aside
        className="detail-panel budget-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="panel-header panel-header-end">
          <button className="icon-button" onClick={onClose} aria-label="Close budget">
            <X size={20} />
          </button>
        </div>
        <p className="eyebrow">Your budget</p>
        <h2 id="budget-title">Where your money goes</h2>
        <p className="panel-subheading">The next 12 months, based on your bank history and your plans.</p>

        {!budget ? (
          <p className="panel-subheading">{error || "Adding things up…"}</p>
        ) : (
          <>
            <div className="month-chips" role="tablist" aria-label="Month">
              {budget.months.map((m, i) => (
                <button
                  key={m.label}
                  className={`${i === picked ? "active" : ""} ${m.leftover < 0 ? "tight" : ""}`}
                  onClick={() => setPicked(i)}
                >
                  {m.label.split(" ")[0].slice(0, 3)}
                </button>
              ))}
            </div>

            <div className="budget-totals">
              <div><small>Income</small><strong>{money(month.income)}</strong></div>
              <div><small>Spending</small><strong>{money(month.spending)}</strong></div>
              <div className={month.leftover < 0 ? "over" : "under"}>
                <small>Left over</small>
                <strong>{money(month.leftover)}</strong>
              </div>
            </div>

            <section className="panel-block">
              <p className="eyebrow">{month.label}</p>
              <div className="budget-rows">
                {month.categories.map((c) => (
                  <div key={c.key} className="budget-row">
                    <span>{c.label}</span>
                    <span className="budget-bar">
                      <i style={{ width: `${Math.min(100, (c.amount / month.income) * 100)}%` }} />
                    </span>
                    <strong>{money(c.amount)}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel-block">
              <p className="eyebrow">Income vs spending, next 12 months</p>
              <ForecastChart options={series} selectedId="spending" months={11} />
            </section>

            <p className="path-why">
              Average spending: {money(budget.avgSpending)}/mo. Busiest month: {budget.busiest.label} ({money(budget.busiest.spending)}).
              {tightMonths.length > 0 &&
                ` Heads up: ${tightMonths.map((m) => m.label.split(" ")[0]).join(" and ")} ${tightMonths.length > 1 ? "run" : "runs"} over your income, so setting a little aside before then helps.`}
            </p>
            <button
              className="primary-button"
              onClick={() => onAsk(`How should I prepare for ${budget.busiest.label}, my most expensive month?`)}
            >
              <Bot size={18} /> Ask Cosmo how to prepare
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
