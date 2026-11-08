import { useEffect, useState } from "react";
import { Bookmark, FolderOpen, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { fillMonths, gapsBetween } from "../lib/forecast";
import ForecastChart from "./ForecastChart";

// Save paths to Tiger Data, reopen them later, and compare their forecasts over time.
// Hides itself completely when the database isn't set up.
export default function SavedPaths({ customerId, selected, whatIfs, onOpen }) {
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved] = useState([]);
  const [compare, setCompare] = useState([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [bucket, setBucket] = useState("month");   // "month" or "quarter", grouped by Tiger's time_bucket

  const load = async (b = bucket) => {
    const list = await api(`/api/customers/${customerId}/saved-paths`);
    setSaved(list);
    const ids = list.slice(0, 3).map((p) => p.id);
    // Forecasts come back from Tiger Data's hypertable, grouped with time_bucket
    setCompare(ids.length >= 2 ? await api(`/api/saved-paths/compare?ids=${ids.join(",")}&bucket=${b}`) : []);
  };

  useEffect(() => {
    api("/api/db/status")
      .then((s) => {
        setEnabled(s.enabled);
        if (s.enabled) load().catch(() => setStatus("Couldn't load your saved paths."));
      })
      .catch(() => setEnabled(false));
  }, [customerId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled) return null;

  const save = async (e) => {
    e.preventDefault();
    setStatus("Saving…");
    try {
      await api("/api/paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, optionId: selected.id, name: name.trim() || selected.label, assumptions: whatIfs }),
      });
      setName("");
      setStatus("Saved");
      await load();
    } catch {
      setStatus("Couldn't save this path. Try again.");
    }
  };

  const changeBucket = (b) => {
    setBucket(b);
    load(b).catch(() => {});
  };

  const remove = async (id) => {
    await api(`/api/saved-paths/${id}`, { method: "DELETE" }).catch(() => {});
    await load().catch(() => {});
  };

  // Shape the compared forecasts like simulator options so we can reuse ForecastChart
  const compareOptions = compare.map((series) => {
    const path = saved.find((p) => p.id === series.id);
    return {
      id: String(series.id),
      label: path?.name ?? `Path ${series.id}`,
      recommended: false,
      forecast: fillMonths(series.points).map((p) => ({ month: p.month, net: p.net, balance: p.savings, events: [] })),
    };
  });

  const gaps = compareOptions.length >= 2 ? gapsBetween(compareOptions[0], compareOptions[1]) : [];

  return (
    <section className="path-box">
      <div className="path-box-head">
        <div>
          <p className="eyebrow">Saved paths</p>
          <h2>Keep the ones worth coming back to</h2>
          <p className="path-sub">Saved with your what-ifs and plans, so you can reopen them exactly.</p>
        </div>
      </div>

      <form className="save-form" onSubmit={save}>
        <input
          aria-label="Name this path"
          placeholder={selected.label}
          value={name}
          onChange={(e) => { setName(e.target.value); setStatus(""); }}
        />
        <button type="submit" className="primary-button">
          <Bookmark size={16} /> Save this path
        </button>
        {status && <span className="save-status">{status}</span>}
      </form>

      {saved.length > 0 && (
        <ul className="saved-list">
          {saved.map((p) => (
            <li key={p.id}>
              <div>
                <strong>{p.name}</strong>
                <small>
                  {p.pathLabel} · In 5 years: {money(p.endValue)} · Saved{" "}
                  {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </small>
              </div>
              <button className="text-button" onClick={() => onOpen(p)}>
                <FolderOpen size={15} /> Open
              </button>
              <button className="icon-button" aria-label={`Delete ${p.name}`} onClick={() => remove(p.id)}>
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {compareOptions.length >= 2 && (
        <div className="saved-compare">
          <div className="saved-compare-head">
            <p className="eyebrow">Compare your latest saved paths</p>
            <div className="segmented" role="group" aria-label="Group by">
              {["month", "quarter"].map((b) => (
                <button key={b} className={bucket === b ? "active" : ""} onClick={() => changeBucket(b)}>
                  {b === "month" ? "Month" : "Quarter"}
                </button>
              ))}
            </div>
          </div>
          <ForecastChart options={compareOptions} selectedId={compareOptions[0].id} months={60} />
          <div className="stat-grid">
            {gaps.map((g) => (
              <div key={g.years}>
                <small>Gap at {g.years} {g.years === 1 ? "year" : "years"}</small>
                <strong>{money(g.amount)}</strong>
                <small>{g.ahead} ahead</small>
              </div>
            ))}
          </div>
          <p className="tiger-note">
            {bucket === "month" ? "61 monthly points per path" : "21 quarters per path, averaged with time_bucket"} · Stored in Tiger Data
          </p>
        </div>
      )}
    </section>
  );
}
