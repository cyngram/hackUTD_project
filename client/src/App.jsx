import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bot,
  Building2,
  CarFront,
  Check,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Fuel,
  Home,
  Landmark,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  MoreHorizontal,
  PiggyBank,
  Plus,
  ReceiptText,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
  WalletCards,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { api } from "./lib/api";
import { money, initials, greeting, todayLabel } from "./lib/format";
import { ICONS, DEFAULT_ICON } from "./lib/icons";
import PathExplorer from "./components/PathExplorer";
import CosmoPanel from "./components/CosmoPanel";

const slogans = [
  "everything circling your financial life",
  "Keep your money in orbit",
];

const detailData = {
  accounts: {
    heading: "Accounts overview",
    subheading: "Every account, moving together.",
    metric: "$32,845.20",
    metricLabel: "Total cash balance",
    insights: [
      ["Savings pace", "On track", "You are saving 14.8% of take-home income."],
      [
        "Monthly cash flow",
        "+$1,240",
        "Income is comfortably ahead of recurring spending.",
      ],
      [
        "Emergency runway",
        "5.2 months",
        "Just 0.8 months from your recommended cushion.",
      ],
    ],
  },
  home: {
    heading: "Home finances",
    subheading: "Your mortgage, utilities, and lease details.",
    metric: "$2,184",
    metricLabel: "Average monthly cost",
    insights: [
      ["Mortgage", "$1,824/mo", "4.25% fixed rate · 24 years remaining"],
      ["Utilities", "$360/mo", "Down $31 compared with last month."],
      [
        "Projection",
        "$4,980 saved",
        "Estimated annual benefit from current rate.",
      ],
    ],
  },
};

function App() {
  const [sloganIndex, setSloganIndex] = useState(0);
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [cosmoOpen, setCosmoOpen] = useState(false);
  const [customers, setCustomers] = useState([]);          // the account list for "Switch account"
  const [customerId, setCustomerId] = useState("maria");   // which account is showing
  const [overview, setOverview] = useState(null);          // accounts, home, vehicle, credit, health
  const [moments, setMoments] = useState(null);            // "Coming up" + nudges
  const [paths, setPaths] = useState(null);                // path results, loaded early so the path page opens instantly
  const [treatPick, setTreatPick] = useState(null);        // which "treat yourself" chip is selected
  const [pathsOpen, setPathsOpen] = useState(false);       // is the path explorer open?
  const [cosmoContext, setCosmoContext] = useState(null);  // question + scenario when Cosmo opens from the path page
  const [loadError, setLoadError] = useState("");

  // Load the account list once, when the page opens
  useEffect(() => {
    api("/api/customers").then(setCustomers).catch((e) => setLoadError(e.message));
  }, []);

  // Load this account's data every time customerId changes
  useEffect(() => {
    let stale = false;                 // becomes true if the user switches again before this finishes
    setOverview(null);
    setMoments(null);
    setPaths(null);
    Promise.all([
      api(`/api/customers/${customerId}/overview`),
      api(`/api/customers/${customerId}/moments`),
    ])
      .then(([o, m]) => {
        if (stale) return;             // ignore an old answer that arrived late
        setOverview(o);
        setMoments(m);
      })
      .catch((e) => !stale && setLoadError(e.message));
    // Load the paths in the background, so "Explore your paths" opens instantly
    api("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId }),
    })
      .then((sim) => !stale && setPaths(sim))
      .catch(() => {});                // the path page will fetch again if this fails
    return () => { stale = true; };    // React runs this cleanup before the next load
  }, [customerId]);

  const customer = customers.find((c) => c.id === customerId);
  const menuRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(
      () => setSloganIndex((value) => (value + 1) % slogans.length),
      10000,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    const handleClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#" aria-label="Orbit dashboard">
          <img src="/brand/orbit-mark.png" alt="" />
          <span>rbit</span>
        </a>

        <div className="slogan" aria-live="polite">
          <span key={sloganIndex}>{slogans[sloganIndex]}</span>
        </div>

        <div className="header-actions">
          <button
            className="icon-button notification-button"
            aria-label="Notifications"
          >
            <Bell size={20} strokeWidth={1.8} />
            <span className="notification-dot" />
          </button>

          <div className="menu-wrap" ref={menuRef}>
            <button
              className="icon-button"
              aria-label="Open settings menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X size={21} /> : <Menu size={23} />}
            </button>
            {menuOpen && (
              <div className="popover menu-popover">
                <p className="popover-label">Quick controls</p>
                <button>
                  <Settings size={17} /> Settings <ChevronRight size={15} />
                </button>
                <button onClick={() => setDark((value) => !value)}>
                  {dark ? <Sun size={17} /> : <Moon size={17} />}
                  {dark ? "Light mode" : "Dark mode"}
                  <span className={`switch ${dark ? "active" : ""}`}>
                    <span />
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className="profile-wrap" ref={profileRef}>
            <button
              className="avatar-button"
              aria-label="Open account menu"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((value) => !value)}
              onMouseEnter={() => setProfileOpen(true)}
            >
              <UserRound size={20} />
              <span>{initials(customer?.name)}</span>
            </button>
            {profileOpen && (
              <div
                className="popover profile-popover"
                onMouseLeave={() => setProfileOpen(false)}
              >
                <div className="profile-summary">
                  <span className="profile-avatar">{initials(customer?.name)}</span>
                  <div>
                    <strong>{customer?.name ?? "Loading…"}</strong>
                    <small>{customer?.household}</small>
                  </div>
                </div>
                <p className="popover-label">Connected accounts</p>
                <button>
                  <CarFront size={17} /> Toyota Financial Services
                  <small className="connected">✓ Connected</small>
                </button>
                <button>
                  <Landmark size={17} /> PNC Checking + Savings
                  <small className="connected">✓ Connected</small>
                </button>
                <button>
                  <Plus size={17} /> Connect another account
                </button>
                <p className="popover-label">Switch account</p>
                {customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setCustomerId(c.id); setProfileOpen(false); }}
                  >
                    <UserRound size={17} /> {c.name}
                    {c.id === customerId && <Check size={15} />}
                  </button>
                ))}
                <button className="danger">
                  <LogOut size={17} /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {pathsOpen ? (
        <PathExplorer
          key={`${customerId}-${treatPick?.label ?? "paths"}`}
          customerId={customerId}
          comingUp={moments?.comingUp?.[0]}
          treat={treatPick}
          baseIncome={overview?.monthlyIncome}
          initialSim={treatPick?.amount ? null : paths}
          onClose={() => { setPathsOpen(false); setTreatPick(null); }}
          onAskCosmo={(ctx) => { setCosmoContext(ctx); setCosmoOpen(true); }}
        />
      ) : (
      <main>
        <section className="welcome-row">
          <div>
            <p className="eyebrow">{todayLabel()}</p>
            <h1>{greeting()}, {customer?.shortName ?? "there"}.</h1>
            <p className="welcome-copy">
              {loadError ? `Couldn't load your data: ${loadError}` : "Here's what's coming up in your orbit."}
            </p>
          </div>
          <button className="month-button">
            November <ChevronRight size={17} />
          </button>
        </section>

        <section className="snapshot-grid" aria-label="Financial snapshot">
          <article className="net-worth-card coming-up">
            <div>
              {moments?.comingUp?.[0] ? (
                <>
                  <p className="eyebrow light">Coming up · {moments.comingUp[0].when}</p>
                  <h2>{moments.comingUp[0].title}</h2>
                  <p className="coming-detail">{moments.comingUp[0].detail}</p>
                  <button className="explore-button" onClick={() => setPathsOpen(true)}>
                    Explore your paths <ArrowRight size={17} />
                  </button>
                </>
              ) : (
                <>
                  <p className="eyebrow light">Your orbit</p>
                  <h2>{moments ? "Everything's steady" : "Loading your orbit…"}</h2>
                </>
              )}
            </div>
            <div className="orbit-visual" aria-hidden="true">
              <span className="orbit-ring ring-one" />
              <span className="orbit-ring ring-two" />
              <span className="orbit-ring ring-three" />
              <span className="planet p-one" />
              <span className="planet p-two" />
              <span className="planet p-three" />
            </div>
          </article>

          <article className="credit-card-panel">
            <div className="credit-copy">
              <div className="card-title-row">
                <span className="mini-icon">
                  <ShieldCheck size={19} />
                </span>
                <div>
                  <p className="eyebrow">Credit score</p>
                  <p>{overview?.creditScore.label ?? "…"}</p>
                </div>
              </div>
              <p className="credit-tip">
                {overview?.creditScore.value >= 740
                  ? "You're in great shape. Keep paying on time."
                  : "Keep card use under 30% to reach Very good (740+)."}
              </p>
            </div>
            <div
              className="gauge"
              style={{ "--score": `${overview ? Math.round(((overview.creditScore.value - 300) / 550) * 88) : 0}%` }}
            >
              <div>
                <strong>{overview?.creditScore.value ?? "—"}</strong>
                <span>of 850</span>
              </div>
            </div>
          </article>
        </section>

        <div className="section-heading">
          <div>
            <p className="eyebrow">Your orbit</p>
            <h2>Everything in one place</h2>
          </div>
          <button className="text-button">
            View activity <ArrowRight size={17} />
          </button>
        </div>

        <section className="finance-grid">
          {overview?.sections.map((section) => {
            const SectionIcon = ICONS[section.icon] ?? DEFAULT_ICON;
            return (
              <button
                key={section.id}
                className={`finance-card accent-${section.accent}`}
                onClick={() => (section.id === "vehicles" ? setPathsOpen(true) : setSelected(section.id))}
              >
                <div className="finance-card-head">
                  <span className="section-icon">
                    <SectionIcon size={22} strokeWidth={1.8} />
                  </span>
                  <span className="open-label">
                    Explore <ArrowRight size={16} />
                  </span>
                </div>
                <p className="eyebrow">{section.eyebrow}</p>
                <h3>{section.title}</h3>
                <p className="section-total">{money(section.total)}{section.unit}</p>
                <div className="account-list">
                  {section.items.map((item) => {
                    const ItemIcon = ICONS[item.kind] ?? DEFAULT_ICON;
                    return (
                      <div className="account-row" key={item.label}>
                        <span className="item-icon">
                          <ItemIcon size={17} />
                        </span>
                        <span className="item-copy">
                          <strong>{item.label}</strong>
                          <small>{item.note}</small>
                        </span>
                        <span className="item-value">
                          {item.amount == null ? "" : money(item.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </section>

        <section className="nudge-row">
          {moments?.nudges.map((n) => {
            const NudgeIcon = ICONS[n.type] ?? DEFAULT_ICON;
            return (
              <article className="nudge-card" key={n.type}>
                <span className="nudge-icon">
                  <NudgeIcon size={20} />
                </span>
                <div>
                  <p className="eyebrow">{n.title}</p>
                  <p className="nudge-text">{n.text}</p>
                  {n.ideas && (
                    <div className="treat-chips">
                      {n.ideas.map((idea) => (
                        <button
                          key={idea.label}
                          className={treatPick?.label === idea.label ? "active" : ""}
                          onClick={() => { setTreatPick(idea); setPathsOpen(true); }}
                        >
                          {idea.label}
                          {idea.amount ? ` · ${money(idea.amount)}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </main>
      )}

      <button className="cosmo-launcher" onClick={() => { setCosmoContext(null); setCosmoOpen(true); }}>
        <span className="cosmo-avatar">
          <Bot size={22} />
        </span>
        <span>
          <small>Your financial co-pilot</small>
          <strong>Chat with Cosmo</strong>
        </span>
        <MessageCircle size={20} />
      </button>

      {selected && (
        <DetailPanel
          section={selected}
          onClose={() => setSelected(null)}
          onAsk={() => {
            setSelected(null);
            setCosmoOpen(true);
          }}
        />
      )}
      {cosmoOpen && (
        <CosmoPanel
          key={`${customerId}-${cosmoContext?.prompt ?? "chat"}`}
          customerId={customerId}
          name={customer?.shortName}
          cosmoPrompt={moments?.cosmoPrompt}
          context={cosmoContext}
          onClose={() => setCosmoOpen(false)}
        />
      )}
    </div>
  );
}

function DetailPanel({ section, onClose, onAsk }) {
  const data = detailData[section];
  const icons =
    section === "accounts"
      ? [PiggyBank, CircleDollarSign, Landmark]
      : section === "home"
        ? [Building2, ReceiptText, CircleDollarSign]
        : [CircleDollarSign, Wrench, CarFront];

  return (
    <div className="overlay" role="presentation" onMouseDown={onClose}>
      <aside
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          <button className="back-button" onClick={onClose}>
            <ArrowLeft size={18} /> Dashboard
          </button>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close details"
          >
            <X size={20} />
          </button>
        </div>
        <p className="eyebrow">Orbit detail</p>
        <h2 id="detail-title">{data.heading}</h2>
        <p className="panel-subheading">{data.subheading}</p>
        <div className="detail-metric">
          <strong>{data.metric}</strong>
          <span>{data.metricLabel}</span>
        </div>
        <div className="detail-insights">
          {data.insights.map(([title, value, description], index) => {
            const InsightIcon = icons[index];
            return (
              <article key={title}>
                <span>
                  <InsightIcon size={20} />
                </span>
                <div>
                  <p>{title}</p>
                  <strong>{value}</strong>
                  <small>{description}</small>
                </div>
                <ChevronRight size={18} />
              </article>
            );
          })}
        </div>
        <button className="primary-button" onClick={onAsk}>
          <Bot size={18} /> Build a plan with Cosmo
        </button>
      </aside>
    </div>
  );
}

export default App;
