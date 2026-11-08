import { useState } from "react";
import { Bot, X } from "lucide-react";
import { money } from "../lib/format";
import { ICONS, DEFAULT_ICON } from "../lib/icons";

const STATUS_TEXT = { strong: "Strong", okay: "Okay", low: "Needs attention" };

// Side panel for the Accounts and Home cards. Real numbers from /overview, plus something to try.
export default function InsightPanel({ section, overview, onClose, onAsk }) {
  const [housingChange, setHousingChange] = useState(0);   // what-if: % change in rent/mortgage

  const accounts = overview.sections.find((s) => s.id === "accounts");
  const home = overview.sections.find((s) => s.id === "home");
  const housing = home.items.find((i) => i.kind === "housing");
  const leftover = overview.monthlyIncome - overview.monthlyExpenses;

  // Home what-if: how a rent/mortgage change moves your month
  const newHousing = Math.round(housing.amount * (1 + housingChange / 100));
  const newLeftover = leftover - (newHousing - housing.amount);
  const share = Math.round((newHousing / overview.monthlyIncome) * 100);
  const shareStatus = share <= 30 ? "strong" : share <= 36 ? "okay" : "low";

  return (
    <div className="overlay" role="presentation" onMouseDown={onClose}>
      <aside
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="panel-header panel-header-end">
          <button className="icon-button" onClick={onClose} aria-label="Close details">
            <X size={20} />
          </button>
        </div>

        {section === "accounts" ? (
          <>
            <p className="eyebrow">Your money</p>
            <h2 id="detail-title">Your financial health</h2>
            <p className="panel-subheading">Four signs a bank looks at, in plain words.</p>
            <div className="detail-metric">
              <strong>{money(accounts.total)}</strong>
              <span>Checking + savings</span>
            </div>
            <div className="health-list">
              {overview.health.map((h) => (
                <article key={h.key} className={`health-item ${h.status}`}>
                  <div className="health-top">
                    <strong>{h.label}</strong>
                    <span className="health-pill">{STATUS_TEXT[h.status]}</span>
                  </div>
                  <p className="health-value">{h.display}</p>
                  <small>{h.tip}</small>
                </article>
              ))}
            </div>
            <div className="mini-list">
              {accounts.items.map((item) => {
                const Icon = ICONS[item.kind] ?? DEFAULT_ICON;
                return (
                  <div key={item.label}>
                    <Icon size={16} />
                    <span>{item.label}{item.note ? <small> · {item.note}</small> : null}</span>
                    <strong>{money(item.amount)}</strong>
                  </div>
                );
              })}
            </div>
            <button className="primary-button" onClick={() => onAsk("What's the most important thing I can do to improve my financial health?")}>
              <Bot size={18} /> Ask Cosmo how to improve
            </button>
          </>
        ) : (
          <>
            <p className="eyebrow">Your place</p>
            <h2 id="detail-title">Your home costs</h2>
            <p className="panel-subheading">A common rule of thumb: keep housing at or under 30% of your income.</p>
            <div className="detail-metric">
              <strong>{money(home.total)}/mo</strong>
              <span>{housing.label} + utilities</span>
            </div>
            <div className="mini-list">
              {home.items.map((item) => {
                const Icon = ICONS[item.kind] ?? DEFAULT_ICON;
                return (
                  <div key={item.label}>
                    <Icon size={16} />
                    <span>{item.label}</span>
                    <strong>{money(item.amount)}</strong>
                  </div>
                );
              })}
            </div>
            <section className="panel-block">
              <p className="eyebrow">What if your {housing.label.toLowerCase()} changed?</p>
              <label className="what-if-item">
                <span className="what-if-top">
                  <span>{housingChange > 0 ? "+" : ""}{housingChange}%</span>
                  <output>{money(newHousing)}/mo</output>
                </span>
                <input
                  type="range"
                  min="-20"
                  max="40"
                  step="5"
                  value={housingChange}
                  onChange={(e) => setHousingChange(Number(e.target.value))}
                />
              </label>
              <div className={`health-item ${shareStatus}`}>
                <div className="health-top">
                  <strong>{share}% of your income</strong>
                  <span className="health-pill">{STATUS_TEXT[shareStatus]}</span>
                </div>
                <small>
                  You'd have {money(newLeftover)} left each month
                  {housingChange !== 0 ? ` (${newLeftover >= leftover ? "+" : "-"}${money(Math.abs(newLeftover - leftover))})` : ""}.
                </small>
              </div>
            </section>
            <button
              className="primary-button"
              onClick={() =>
                onAsk(
                  housingChange
                    ? `Could I comfortably handle ${housing.label.toLowerCase()} of ${money(newHousing)} a month?`
                    : "How much could I comfortably spend on housing?",
                )
              }
            >
              <Bot size={18} /> Ask Cosmo about this
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
