import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  CarFront,
  CheckCircle2,
  Flag,
  GraduationCap,
  Home,
  Plane,
  Plus,
  RefreshCw,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import ForecastChart, { colorFor } from "./ForecastChart";
import SavedPaths from "./SavedPaths";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const PATH_ICONS = { finance: CarFront, lease: RefreshCw, keep: Wrench };
const RANGES = [
  { months: 12, label: "1Y" },
  { months: 24, label: "2Y" },
  { months: 60, label: "5Y" },
];

// The what-if sliders. To add one, add a line here (and accept the key in the backend).
const WHAT_IFS = [
  { key: "gasPrice", label: "Gas price", min: () => 2, max: () => 6, step: 0.1, show: (v) => `$${v.toFixed(2)}/gal` },
  {
    key: "monthlyIncome",
    label: "Monthly income",
    min: () => 0,
    max: (income) => Math.round((income * 2) / 100) * 100,
    step: 100,
    show: (v) => `${money(v)}/mo`,
  },
  { key: "surpriseRepair", label: "One-time expense", min: () => 0, max: () => 5000, step: 100, show: (v) => money(v) },
];

// Milestones: life goals on any path (not just the car)
const MILESTONE_KINDS = [
  { value: "home", label: "Home", icon: Home },
  { value: "trip", label: "Trip", icon: Plane },
  { value: "opportunity", label: "New opportunity", icon: GraduationCap },
  { value: "goal", label: "Other goal", icon: Flag },
];
const milestoneIcon = (kind) => (MILESTONE_KINDS.find((k) => k.value === kind) ?? MILESTONE_KINDS[3]).icon;
const THIS_YEAR = new Date().getFullYear();
const emptyMilestone = () => ({ label: "", kind: "home", amount: "", month: new Date().getMonth(), year: THIS_YEAR + 2 });

// How a milestone is doing on a path, in plain words
function milestoneStatus(m) {
  if (m.onTrack) return { ok: true, text: `On track · ${m.reached}` };
  if (m.reached) return { ok: false, text: `Late · ${m.reached}` };
  return { ok: false, text: "Not within 5 years" };
}

const emptyDraft = () => ({ label: "", amount: "", kind: "expense", repeat: "once", month: (new Date().getMonth() + 1) % 12 });

export default function PathExplorer({ customerId, comingUp, treat, baseIncome, initialSim, onClose, onAskCosmo }) {
  // Only send what the user changed; the backend fills in its own defaults (gas price, their income, their plans)
  const [whatIfs, setWhatIfs] = useState(treat?.amount ? { surpriseRepair: treat.amount } : {});
  const [sim, setSim] = useState(initialSim ?? null);   // starts with the results the home screen already loaded
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);   // null = our pick
  const [range, setRange] = useState(60);
  const [tab, setTab] = useState("whatifs");
  const [draft, setDraft] = useState(emptyDraft);
  const [draftError, setDraftError] = useState("");
  const [milestoneDraft, setMilestoneDraft] = useState(emptyMilestone);
  const [milestoneError, setMilestoneError] = useState("");

  // Start at the top of the page (braces matter: an effect may only return a cleanup function)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Re-run the simulator whenever something changes (waits 250 ms so dragging doesn't flood the server)
  const firstRun = useRef(true);
  useEffect(() => {
    const isFirst = firstRun.current;
    firstRun.current = false;
    if (isFirst && initialSim && Object.keys(whatIfs).length === 0) return;   // already have these results
    let stale = false;
    const timer = setTimeout(() => {
      api("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, assumptions: whatIfs }),
      })
        .then((data) => !stale && setSim(data))
        .catch((e) => !stale && setError(e.message));
    }, isFirst ? 0 : 250);   // no delay on the first load
    return () => { stale = true; clearTimeout(timer); };
  }, [customerId, whatIfs]);

  const plans = whatIfs.plans ?? sim?.assumptions.plans ?? [];
  const setPlans = (next) => setWhatIfs((prev) => ({ ...prev, plans: next }));

  const addPlan = (e) => {
    e.preventDefault();
    const amount = Number(draft.amount);
    if (!draft.label.trim()) return setDraftError("Give your plan a name.");
    if (!amount || amount <= 0) return setDraftError("Enter an amount above $0.");
    setPlans([
      ...plans,
      {
        label: draft.label.trim(),
        amount: draft.kind === "expense" ? -amount : amount,
        month: Number(draft.month),
        repeat: draft.repeat === "yearly",   // false = happens once, the next time that month comes around
      },
    ]);
    setDraft(emptyDraft());
    setDraftError("");
  };

  const milestones = whatIfs.milestones ?? sim?.assumptions.milestones ?? [];
  const setMilestones = (next) => setWhatIfs((prev) => ({ ...prev, milestones: next }));

  const addMilestone = (e) => {
    e.preventDefault();
    const amount = Number(milestoneDraft.amount);
    const now = new Date();
    const targetMonth = (Number(milestoneDraft.year) - now.getFullYear()) * 12 + (Number(milestoneDraft.month) - now.getMonth());
    if (!milestoneDraft.label.trim()) return setMilestoneError("Give your milestone a name.");
    if (!amount || amount <= 0) return setMilestoneError("Enter an amount above $0.");
    if (targetMonth < 1 || targetMonth > 60) return setMilestoneError("Pick a date within the next 5 years.");
    setMilestones([...milestones, { label: milestoneDraft.label.trim(), kind: milestoneDraft.kind, amount, targetMonth }]);
    setMilestoneDraft(emptyMilestone());
    setMilestoneError("");
  };

  const selected = sim?.options.find((o) => o.id === (selectedId ?? sim.recommendation.optionId));

  // Big number + how it compares with the other paths at the end of the chosen range
  let endValue = 0;
  let delta = null;
  if (selected) {
    endValue = selected.forecast[range].net;
    const others = sim.options.filter((o) => o.id !== selected.id);
    const bestOther = others.reduce((a, b) => (b.forecast[range].net > a.forecast[range].net ? b : a), others[0]);
    const gap = endValue - bestOther.forecast[range].net;
    delta = gap >= 0
      ? { up: true, text: `${money(gap)} ahead of the next path` }
      : { up: false, text: `${money(-gap)} behind ${bestOther.label.toLowerCase()}` };
  }

  return (
    <main className="path-page">
      <button className="back-link" onClick={onClose}>
        <ArrowLeft size={17} /> Dashboard
      </button>
      <p className="eyebrow">{comingUp?.title ?? "Your next chapter"}</p>
      <div className="path-page-head">
        <h1>Pick a path to explore</h1>
        <p>You can change direction anytime. Nothing here is locked in.</p>
      </div>
      {treat?.amount > 0 && (
        <p className="path-note">Including {treat.label.toLowerCase()} ({money(treat.amount)}) as a one-time expense.</p>
      )}

      {!sim || !selected ? (
        <p className="path-note">{error || "Mapping your paths…"}</p>
      ) : (
        <>
          <section className="path-choices">
            {sim.options.map((o, i) => {
              const Icon = PATH_ICONS[o.type] ?? CarFront;
              const active = o.id === selected.id;
              return (
                <button
                  key={o.id}
                  className={`path-choice ${active ? "active" : ""}`}
                  onClick={() => setSelectedId(o.id)}
                  aria-pressed={active}
                >
                  <span className="path-choice-icon" style={{ color: colorFor(i) }}>
                    <Icon size={20} />
                  </span>
                  <span className="path-choice-copy">
                    <strong>{o.label}</strong>
                    <small>
                      {o.recommended ? "Our pick · " : ""}
                      {money(o.monthly.totalCar)}/mo · 5-year cost {money(o.fiveYear.netCost)}
                    </small>
                    <small>
                      {o.nextService
                        ? `Next: ${o.nextService.label.toLowerCase()}${o.nextService.atMiles ? ` at ${o.nextService.atMiles.toLocaleString("en-US")} mi` : ""}, ${o.nextService.when} · ${o.nextService.amount ? money(o.nextService.amount) : "included"}`
                        : "Service covered while leasing"}
                    </small>
                    {o.milestones.length > 0 && (
                      <small>
                        {o.milestones.filter((m) => m.onTrack).length} of {o.milestones.length} milestones on track
                      </small>
                    )}
                    {!o.stress.holdsUp && (
                      <small className="path-dip">
                        <AlertTriangle size={13} /> Savings dip below $0
                      </small>
                    )}
                  </span>
                  {active ? <CheckCircle2 size={20} className="path-check" /> : <ArrowRight size={18} className="path-arrow" />}
                </button>
              );
            })}
          </section>

          <section className="path-box">
            <div className="path-box-head">
              <div>
                <p className="eyebrow">What you'd own</p>
                <h2>{selected.label}</h2>
                <p className="path-sub">Savings + car value − what's left on the loan, including your plans.</p>
              </div>
              <div className="segmented" role="group" aria-label="Time range">
                {RANGES.map((r) => (
                  <button key={r.label} className={range === r.months ? "active" : ""} onClick={() => setRange(r.months)}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="path-total">
              <strong>{money(endValue)}</strong>
              <span className={`path-delta ${delta.up ? "up" : "down"}`}>{delta.text}</span>
            </div>
            <ForecastChart options={sim.options} selectedId={selected.id} months={range} />
            <p className="path-why">{selected.why}</p>
            {selected.milestones.length > 0 && (
              <div className="milestone-strip">
                {selected.milestones.map((m) => {
                  const Icon = milestoneIcon(m.kind);
                  const status = milestoneStatus(m);
                  return (
                    <div key={m.label} className={`milestone-chip ${status.ok ? "ok" : "late"}`}>
                      <Icon size={16} />
                      <span>
                        <strong>{m.label}</strong>
                        <small>{money(m.amount)} by {m.target} · {status.text}</small>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {sim.smallShift && (
              <div className="small-shift">
                <Sparkles size={18} />
                <p><strong>A small shift goes a long way.</strong> {sim.smallShift}</p>
              </div>
            )}
          </section>

          <section className="path-box">
            <div className="path-box-head">
              <div>
                <p className="eyebrow">Make it yours</p>
                <h2>Adjust and watch your paths respond</h2>
              </div>
              <div className="segmented" role="tablist">
                <button className={tab === "whatifs" ? "active" : ""} onClick={() => setTab("whatifs")}>What-ifs</button>
                <button className={tab === "plans" ? "active" : ""} onClick={() => setTab("plans")}>Plans</button>
                <button className={tab === "milestones" ? "active" : ""} onClick={() => setTab("milestones")}>Milestones</button>
                <button className={tab === "car" ? "active" : ""} onClick={() => setTab("car")}>Your car</button>
              </div>
            </div>

            {tab === "car" ? (
              <div>
                <p className="path-sub" style={{ marginTop: 14 }}>
                  Toyota's maintenance schedules go by miles, not months. Keep these up to date and every path's
                  service dates update with them.
                </p>
                <div className="car-grid">
                  {[
                    { key: "currentMileage", label: "Current mileage", step: 500 },
                    { key: "lastOilChangeMiles", label: "Mileage at your last oil change", step: 500 },
                    { key: "weeklyMiles", label: "Miles you drive per week", step: 10 },
                  ].map((f) => (
                    <label className="car-field" key={f.key}>
                      <span>{f.label}</span>
                      <input
                        type="number"
                        min="0"
                        step={f.step}
                        value={whatIfs[f.key] ?? sim.assumptions[f.key]}
                        onChange={(e) =>
                          setWhatIfs((prev) => ({ ...prev, [f.key]: Math.max(0, Number(e.target.value) || 0) }))
                        }
                      />
                    </label>
                  ))}
                </div>
                {(() => {
                  const weekly = whatIfs.weeklyMiles ?? sim.assumptions.weeklyMiles;
                  const next = selected.nextService;
                  return (
                    <p className="car-summary">
                      About {Math.round((weekly * 52) / 12).toLocaleString("en-US")} miles a month
                      {next ? ` · On this path, next up: ${next.label.toLowerCase()} around ${next.when}` : " · Service is covered on this path"}
                    </p>
                  );
                })()}
              </div>
            ) : tab === "milestones" ? (
              <div>
                <ul className="plan-list">
                  {selected.milestones.map((m) => {
                    const Icon = milestoneIcon(m.kind);
                    const status = milestoneStatus(m);
                    return (
                      <li key={m.label} className="milestone-item">
                        <span className="plan-name"><Icon size={15} /> {m.label}</span>
                        <span className="plan-when">{money(m.amount)} by {m.target}</span>
                        <span className={status.ok ? "plan-in" : "plan-late"}>{status.text}</span>
                        <button
                          className="icon-button"
                          aria-label={`Remove ${m.label}`}
                          onClick={() => setMilestones(milestones.filter((x) => x.label !== m.label))}
                        >
                          <X size={16} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <form className="plan-form milestone-form" onSubmit={addMilestone}>
                  <input
                    aria-label="Milestone name"
                    placeholder="Home down payment"
                    value={milestoneDraft.label}
                    onChange={(e) => { setMilestoneDraft({ ...milestoneDraft, label: e.target.value }); setMilestoneError(""); }}
                  />
                  <select aria-label="Kind" value={milestoneDraft.kind} onChange={(e) => setMilestoneDraft({ ...milestoneDraft, kind: e.target.value })}>
                    {MILESTONE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                  <input
                    aria-label="Amount to save"
                    type="number"
                    min="1"
                    placeholder="20000"
                    value={milestoneDraft.amount}
                    onChange={(e) => { setMilestoneDraft({ ...milestoneDraft, amount: e.target.value }); setMilestoneError(""); }}
                  />
                  <select aria-label="Target month" value={milestoneDraft.month} onChange={(e) => setMilestoneDraft({ ...milestoneDraft, month: e.target.value })}>
                    {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                  <select aria-label="Target year" value={milestoneDraft.year} onChange={(e) => setMilestoneDraft({ ...milestoneDraft, year: e.target.value })}>
                    {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={THIS_YEAR + n}>{THIS_YEAR + n}</option>)}
                  </select>
                  <button type="submit" className="primary-button">
                    <Plus size={16} /> Add milestone
                  </button>
                </form>
                {milestoneError && <p className="form-error">{milestoneError}</p>}
              </div>
            ) : tab === "whatifs" ? (
              <div className="what-if-grid">
                {WHAT_IFS.map((w) => {
                  const value = whatIfs[w.key] ?? sim.assumptions[w.key];   // follow your finger immediately
                  const income = baseIncome ?? sim.assumptions.monthlyIncome;
                  return (
                    <label className="what-if-item" key={w.key}>
                      <span className="what-if-top">
                        <span>{w.label}</span>
                        <output>{w.show(value)}</output>
                      </span>
                      <input
                        type="range"
                        min={w.min(income)}
                        max={w.max(income)}
                        step={w.step}
                        value={value}
                        onChange={(e) => setWhatIfs((prev) => ({ ...prev, [w.key]: Number(e.target.value) }))}
                      />
                    </label>
                  );
                })}
              </div>
            ) : (
              <div>
                <ul className="plan-list">
                  {plans.map((plan, i) => (
                    <li key={`${plan.label}-${i}`}>
                      <span className="plan-name">{plan.label}</span>
                      <span className="plan-when">
                        {plan.repeat === false ? `Once in ${MONTHS[plan.month]}` : `Every ${MONTHS[plan.month]}`}
                      </span>
                      <span className={plan.amount >= 0 ? "plan-in" : "plan-out"}>
                        {plan.amount >= 0 ? "+" : "-"}{money(Math.abs(plan.amount))}
                      </span>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${plan.label}`}
                        onClick={() => setPlans(plans.filter((_, j) => j !== i))}
                      >
                        <X size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
                <form className="plan-form" onSubmit={addPlan}>
                  <input
                    aria-label="Plan name"
                    placeholder="New laptop"
                    value={draft.label}
                    onChange={(e) => { setDraft({ ...draft, label: e.target.value }); setDraftError(""); }}
                  />
                  <select aria-label="Expense or income" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                  <input
                    aria-label="Amount"
                    type="number"
                    min="1"
                    placeholder="1200"
                    value={draft.amount}
                    onChange={(e) => { setDraft({ ...draft, amount: e.target.value }); setDraftError(""); }}
                  />
                  <select aria-label="Month" value={draft.month} onChange={(e) => setDraft({ ...draft, month: e.target.value })}>
                    {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                  <select aria-label="How often" value={draft.repeat} onChange={(e) => setDraft({ ...draft, repeat: e.target.value })}>
                    <option value="once">Once</option>
                    <option value="yearly">Every year</option>
                  </select>
                  <button type="submit" className="primary-button">
                    <Plus size={16} /> Add plan
                  </button>
                </form>
                {draftError && <p className="form-error">{draftError}</p>}
              </div>
            )}
          </section>

          <SavedPaths
            customerId={customerId}
            selected={selected}
            whatIfs={whatIfs}
            onOpen={(path) => {
              setWhatIfs(path.assumptions ?? {});   // restore the saved what-ifs and plans
              setSelectedId(path.optionId);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />

          <section className="next-step">
            <CheckCircle2 size={22} />
            <div>
              <strong>{sim.recommendation.headline}</strong>
              <p>Next step: {sim.recommendation.nextStep}</p>
            </div>
            <button
              className="primary-button"
              onClick={() =>
                onAskCosmo({
                  prompt: `Walk me through my paths. Why is ${sim.recommendation.headline.split(": ")[1] ?? "your pick"} the best fit for me, and what would change your mind?`,
                  assumptions: whatIfs,   // Cosmo sees the same scenario as this page
                })
              }
            >
              <Bot size={18} /> Ask Cosmo
            </button>
          </section>
        </>
      )}
    </main>
  );
}
