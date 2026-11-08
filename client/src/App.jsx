import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bot,
  Building2,
  CarFront,
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

const slogans = ["everything circling your financial life", "Keep your money in orbit"];

const sections = [
  {
    id: "accounts",
    eyebrow: "Your money",
    title: "Accounts",
    icon: WalletCards,
    total: "$32,845.20",
    accent: "blue",
    items: [
      { label: "Checking", value: "$7,420.18", meta: "+$1,240 this month", icon: CreditCard },
      { label: "Savings", value: "$25,425.02", meta: "68% of annual goal", icon: PiggyBank },
    ],
  },
  {
    id: "home",
    eyebrow: "Your place",
    title: "Home",
    icon: Home,
    total: "$2,184/mo",
    accent: "sand",
    items: [
      { label: "Mortgage", value: "$1,824.00", meta: "Due in 12 days", icon: Building2 },
      { label: "Utilities", value: "$360.00", meta: "8% lower than last month", icon: Zap },
    ],
  },
  {
    id: "vehicles",
    eyebrow: "Your ride",
    title: "Vehicles",
    icon: CarFront,
    total: "$642/mo",
    accent: "green",
    items: [
      {
        label: "2021 Toyota RAV4",
        value: "$428.00",
        meta: "18 payments remaining",
        icon: CarFront,
      },
      { label: "Maintenance", value: "Good", meta: "Service due in 1,240 miles", icon: Wrench },
    ],
  },
];

const detailData = {
  accounts: {
    heading: "Accounts overview",
    subheading: "Every account, moving together.",
    metric: "$32,845.20",
    metricLabel: "Total cash balance",
    insights: [
      ["Savings pace", "On track", "You are saving 14.8% of take-home income."],
      ["Monthly cash flow", "+$1,240", "Income is comfortably ahead of recurring spending."],
      ["Emergency runway", "5.2 months", "Just 0.8 months from your recommended cushion."],
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
      ["Projection", "$4,980 saved", "Estimated annual benefit from current rate."],
    ],
  },
  vehicles: {
    heading: "Vehicle health",
    subheading: "Financing and maintenance for your 2021 Toyota RAV4.",
    metric: "82%",
    metricLabel: "Overall vehicle health",
    insights: [
      ["Financing", "$7,362 left", "18 payments at 5.1% APR."],
      ["Next checkup", "1,240 miles", "Oil, tire rotation, and brake inspection."],
      ["Trade-in window", "8–12 months", "Best balance of equity and expected value."],
    ],
  },
};

const prompts = [
  "Can I afford a trip?",
  "What should I do with my car?",
  "How can I improve my credit?",
];

function App() {
  const [sloganIndex, setSloganIndex] = useState(0);
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [cosmoOpen, setCosmoOpen] = useState(false);
  const menuRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(
      () => setSloganIndex((value) => (value + 1) % slogans.length),
      4200,
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
          <button className="icon-button notification-button" aria-label="Notifications">
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
              <span>JA</span>
            </button>
            {profileOpen && (
              <div className="popover profile-popover" onMouseLeave={() => setProfileOpen(false)}>
                <div className="profile-summary">
                  <span className="profile-avatar">JA</span>
                  <div>
                    <strong>Jordan Avery</strong>
                    <small>jordan@orbit.app</small>
                  </div>
                </div>
                <button>
                  <UserRound size={17} /> Account profile
                </button>
                <button>
                  <LogIn size={17} /> Switch account
                </button>
                <button className="danger">
                  <LogOut size={17} /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="welcome-row">
          <div>
            <p className="eyebrow">Friday, November 8</p>
            <h1>Good morning, Jordan.</h1>
            <p className="welcome-copy">Here’s how your financial world is moving today.</p>
          </div>
          <button className="month-button">
            November <ChevronRight size={17} />
          </button>
        </section>

        <section className="snapshot-grid" aria-label="Financial snapshot">
          <article className="net-worth-card">
            <div>
              <p className="eyebrow light">Total net worth</p>
              <h2>
                $128,460<span>.20</span>
              </h2>
              <p className="positive">
                ↑ 4.8% <span>in the last 30 days</span>
              </p>
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
                  <p>Excellent range</p>
                </div>
              </div>
              <div className="score">730</div>
              <div className="score-change">
                +8 pts <span>this month</span>
              </div>
            </div>
            <div className="gauge" style={{ "--score": "82%" }}>
              <div>
                <strong>730</strong>
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
          {sections.map((section) => {
            const SectionIcon = section.icon;
            return (
              <button
                key={section.id}
                className={`finance-card accent-${section.accent}`}
                onClick={() => setSelected(section.id)}
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
                <p className="section-total">{section.total}</p>
                <div className="account-list">
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <div className="account-row" key={item.label}>
                        <span className="item-icon">
                          <ItemIcon size={17} />
                        </span>
                        <span className="item-copy">
                          <strong>{item.label}</strong>
                          <small>{item.meta}</small>
                        </span>
                        <span className="item-value">{item.value}</span>
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </section>

        <section className="insight-banner">
          <div className="insight-icon">
            <Sparkles size={22} />
          </div>
          <div>
            <p className="eyebrow">Orbit insight</p>
            <h3>You’re on pace to save $3,200 more this year.</h3>
            <p>Lower utility costs and steady deposits are moving you ahead of plan.</p>
          </div>
          <button onClick={() => setCosmoOpen(true)}>
            Ask Cosmo <ArrowRight size={17} />
          </button>
        </section>
      </main>

      <button className="cosmo-launcher" onClick={() => setCosmoOpen(true)}>
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
      {cosmoOpen && <CosmoPanel onClose={() => setCosmoOpen(false)} />}
    </div>
  );
}

function DetailPanel({
  section,
  onClose,
  onAsk,
}) {
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
          <button className="icon-button" onClick={onClose} aria-label="Close details">
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

function CosmoPanel({ onClose }) {
  const [messages, setMessages] = useState([
    {
      from: "cosmo",
      text: "Hi Jordan — I’m Cosmo. I can use your accounts, credit, spending, and vehicle details to help you think through your next move. What are we planning?",
    },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const replyFor = (message) => {
    const lower = message.toLowerCase();
    if (lower.includes("trip") || lower.includes("travel")) {
      return "Based on your $1,240 monthly surplus, a $2,400 trip is realistic in about 3 months without touching emergency savings. I’d move $800/month into a separate travel fund, book flexible airfare first, and keep a 15% buffer. To go sooner, reduce the target budget or use up to $420 in card rewards—not your emergency fund. Want to explore other options?";
    }
    if (lower.includes("car") || lower.includes("vehicle") || lower.includes("trade")) {
      return "Your RAV4 has 18 payments left and positive projected equity. The strongest financial option is to keep it for at least 8 more months, complete the service due in 1,240 miles, and request a trade-in estimate after that. Trading now is possible, but it would likely add about $95/month to a comparable loan. Want to compare keeping it, refinancing, and trading it in?";
    }
    if (lower.includes("credit")) {
      return "At 730, your score is already strong. The most useful next step is keeping card utilization below 10% before statement dates; that could help more than opening another account. Continue on-time payments and avoid a hard inquiry until your next major financing decision. Want a 90-day score plan?";
    }
    return "I can build that into a plan using your $32,845 cash balance, $1,240 monthly surplus, 730 credit score, and current payments. I’ll show the safest route first, explain why, and include alternatives. Could you tell me your target amount or ideal timing?";
  };

  const send = (text) => {
    if (!text.trim()) return;
    const clean = text.trim();
    setMessages((items) => [...items, { from: "user", text: clean }]);
    setInput("");
    window.setTimeout(
      () => setMessages((items) => [...items, { from: "cosmo", text: replyFor(clean) }]),
      450,
    );
  };

  const submit = (event) => {
    event.preventDefault();
    send(input);
  };

  return (
    <div className="overlay cosmo-overlay" onMouseDown={onClose}>
      <aside
        className="cosmo-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cosmo-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="cosmo-header">
          <div className="cosmo-title">
            <span className="cosmo-avatar">
              <Bot size={23} />
            </span>
            <div>
              <h2 id="cosmo-title">Cosmo</h2>
              <p>
                <span /> Online · Your financial co-pilot
              </p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close Cosmo">
            <X size={21} />
          </button>
        </header>
        <div className="data-note">
          <ShieldCheck size={15} /> Advice based on your Orbit financial snapshot
        </div>
        <div className="messages">
          {messages.map((message, index) => (
            <div className={`message ${message.from}`} key={`${message.from}-${index}`}>
              {message.from === "cosmo" && (
                <span className="message-avatar">
                  <Bot size={16} />
                </span>
              )}
              <p>{message.text}</p>
            </div>
          ))}
          {messages.length === 1 && (
            <div className="suggested-prompts">
              {prompts.map((prompt) => (
                <button key={prompt} onClick={() => send(prompt)}>
                  {prompt}
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>
        <form className="chat-form" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Cosmo anything…"
            aria-label="Message Cosmo"
          />
          <button type="submit" aria-label="Send message">
            <Send size={18} />
          </button>
        </form>
        <p className="chat-disclaimer">
          Cosmo provides guidance, not professional financial advice.
        </p>
      </aside>
    </div>
  );
}

export default App;
