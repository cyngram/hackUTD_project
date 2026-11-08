import 'dotenv/config';            // loads GEMINI_API_KEY from .env
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url'; 
import fs from 'fs';
import { simulate, overview, moments, affordability, budget, scenarios } from './engine/finance.js';
import { askCosmo } from './engine/cosmo.js';
import { dbReady, query, setupDatabase } from './db.js';

const app = express();
app.use(express.json());    // Parse incoming JSON requests

//figure out the current file's directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client', 'dist');

//----API routes here--------
// Load the two demo customers from the JSON file
function loadCustomers() {
  const filePath = path.join(__dirname, 'data', 'customers.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Only accept the stress-test numbers we expect (ignore anything weird)
function cleanAssumptions(assumptions) {
  const clean = {};
  for (const key of ['gasPrice', 'surpriseRepair', 'monthlyIncome', 'weeklyMiles', 'currentMileage', 'lastOilChangeMiles']) {
    const n = Number(assumptions?.[key]);
    if (assumptions?.[key] !== undefined && !Number.isNaN(n) && n >= 0) clean[key] = n;
  }
  // Plans the user added/edited: [{ label, amount (+income / -expense), month (0 = Jan ... 11 = Dec) }]
  if (Array.isArray(assumptions?.plans)) {
    clean.plans = assumptions.plans
      .slice(0, 12)
      .map((plan) => ({
        label: String(plan?.label ?? '').trim().slice(0, 40),
        amount: Number(plan?.amount),
        month: Number(plan?.month),
        repeat: plan?.repeat !== false,   // default: repeats every year
      }))
      .filter((plan) =>
        plan.label &&
        Number.isFinite(plan.amount) && Math.abs(plan.amount) <= 100000 &&
        Number.isInteger(plan.month) && plan.month >= 0 && plan.month <= 11);
  }
  // Milestones the user added/edited: [{ label, kind, amount, targetMonth (months from now, 1-60) }]
  if (Array.isArray(assumptions?.milestones)) {
    const KINDS = ['home', 'trip', 'opportunity', 'goal'];
    clean.milestones = assumptions.milestones
      .slice(0, 8)
      .map((m) => ({
        label: String(m?.label ?? '').trim().slice(0, 40),
        kind: KINDS.includes(m?.kind) ? m.kind : 'goal',
        amount: Number(m?.amount),
        targetMonth: Number(m?.targetMonth),
      }))
      .filter((m) =>
        m.label &&
        Number.isFinite(m.amount) && m.amount > 0 && m.amount <= 1000000 &&
        Number.isInteger(m.targetMonth) && m.targetMonth >= 1 && m.targetMonth <= 60);
  }
  return clean;
}

// Find a dollar amount in a chat message: "$1,200", "$2k", "1500 dollars", "3k"
function findAmount(message) {
  const text = String(message).toLowerCase();
  const m =
    text.match(/\$\s?(\d[\d,]*(?:\.\d+)?)\s?(k)?/) ||
    text.match(/(\d[\d,]*(?:\.\d+)?)\s?(k|dollars|bucks)\b/);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ''));
  if (m[2] === 'k') n *= 1000;
  return n >= 20 && n <= 1000000 ? n : null;
}

// List of customers (for the picker cards)
app.get('/api/customers', (req, res) => {
  res.json(loadCustomers());
});

// Monthly budget breakdown for the next 12 months
app.get('/api/customers/:id/budget', (req, res) => {
  const customer = loadCustomers().find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json(budget(customer));
});

// "Coming up" moment + nudges for the home screen
app.get('/api/customers/:id/moments', (req, res) => {
  const customer = loadCustomers().find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json(moments(customer));
});

// "Today" picture for one customer: monthly breakdown + health scores
app.get('/api/customers/:id/overview', (req, res) => {
  const customer = loadCustomers().find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json(overview(customer));
});

// The simulator: compare every option for one customer
// Body: { customerId: "alex", assumptions: { gasPrice, monthlyIncome, surpriseRepair, plans, milestones, weeklyMiles, ... } }
app.post('/api/simulate', (req, res) => {
  const { customerId, assumptions = {} } = req.body || {};
  const customer = loadCustomers().find((c) => c.id === customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  res.json(simulate(customer, cleanAssumptions(assumptions)));
});

// Cosmo chat: answers questions using our engine's numbers
// Body: { customerId, message, history: [{ role: 'user'|'cosmo', text }], assumptions }
app.post('/api/chat', async (req, res) => {
  const { customerId, message, history = [], assumptions = {} } = req.body || {};
  const customer = loadCustomers().find((c) => c.id === customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'Message is empty' });

  const sim = simulate(customer, cleanAssumptions(assumptions));
  const amount = findAmount(message);                       // e.g. "can I afford a $1,200 laptop?" -> 1200
  const afford = amount ? affordability(customer, amount) : null;
  const result = await askCosmo({
    customer, overview: overview(customer), sim, message, history, afford,
    whatIfs: scenarios(customer, cleanAssumptions(assumptions)),   // the engine runs the what-ifs, Cosmo explains them
    trends: budget(customer),                                       // seasonal spending for the next 12 months
  });
  res.json(result);
});

// ---------- Saved paths (Tiger Data) ----------
// Is saving available? The frontend hides the Save button when it isn't.
app.get('/api/db/status', (req, res) => res.json({ enabled: dbReady() }));

const requireDb = (req, res, next) =>
  dbReady() ? next() : res.status(503).json({ error: "Saving paths isn't set up" });

// Save a path. The server re-runs the simulation itself: it never trusts numbers sent by the browser.
// Body: { customerId, optionId, name, assumptions }
app.post('/api/paths', requireDb, async (req, res) => {
  const { customerId, optionId, name, assumptions = {} } = req.body || {};
  const customer = loadCustomers().find((c) => c.id === customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const clean = cleanAssumptions(assumptions);
  const sim = simulate(customer, clean);
  const option = sim.options.find((o) => o.id === optionId);
  if (!option) return res.status(400).json({ error: 'Unknown path' });
  const label = String(name || option.label).trim().slice(0, 60);
  const endValue = option.forecast[option.forecast.length - 1].net;

  try {
    const { rows } = await query(
      `INSERT INTO saved_paths (customer_id, option_id, name, path_label, assumptions, end_value)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
      [customerId, optionId, label, option.label, JSON.stringify(clean), endValue],
    );
    const id = rows[0].id;

    // One row per month, dated from the 1st of this month onward
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const times = option.forecast.map((p) => {
      const d = new Date(start);
      d.setMonth(d.getMonth() + p.month);
      return d.toISOString();
    });
    await query(
      `INSERT INTO path_forecasts (time, saved_path_id, net, savings)
       SELECT t, $1, n, s FROM unnest($2::timestamptz[], $3::int[], $4::int[]) AS f(t, n, s)`,
      [id, times, option.forecast.map((p) => p.net), option.forecast.map((p) => p.balance)],
    );
    res.json({ id, name: label, optionId, pathLabel: option.label, endValue, createdAt: rows[0].created_at });
  } catch (err) {
    console.error('Save failed:', err.message);
    res.status(500).json({ error: "Couldn't save this path" });
  }
});

// A customer's saved paths, newest first
app.get('/api/customers/:id/saved-paths', requireDb, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, option_id AS "optionId", path_label AS "pathLabel", assumptions,
              end_value AS "endValue", created_at AS "createdAt"
       FROM saved_paths WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    console.error('List failed:', err.message);
    res.status(500).json({ error: "Couldn't load saved paths" });
  }
});

// Compare saved paths over time with TimescaleDB's time_bucket.
// ?ids=1,2,3&bucket=month|quarter
app.get('/api/saved-paths/compare', requireDb, async (req, res) => {
  const ids = String(req.query.ids || '').split(',').map(Number).filter(Number.isInteger).slice(0, 5);
  if (ids.length === 0) return res.json([]);
  const interval = req.query.bucket === 'quarter' ? '3 months' : '1 month';
  try {
    const { rows } = await query(
      `SELECT saved_path_id AS id,
              time_bucket($2::interval, time) AS bucket,
              round(avg(net))::int AS net,
              round(avg(savings))::int AS savings
       FROM path_forecasts
       WHERE saved_path_id = ANY($1::int[])
       GROUP BY saved_path_id, bucket
       ORDER BY saved_path_id, bucket`,
      [ids, interval],
    );
    // Group into one series per saved path: [{ id, points: [{ month, net, savings }] }]
    const byId = new Map();
    for (const r of rows) {
      if (!byId.has(r.id)) byId.set(r.id, []);
      byId.get(r.id).push({ month: byId.get(r.id).length * (interval === '3 months' ? 3 : 1), net: r.net, savings: r.savings });
    }
    res.json([...byId].map(([id, points]) => ({ id, points })));
  } catch (err) {
    console.error('Compare failed:', err.message);
    res.status(500).json({ error: "Couldn't compare paths" });
  }
});

// Delete a saved path (its forecast rows go too, thanks to ON DELETE CASCADE)
app.delete('/api/saved-paths/:id', requireDb, async (req, res) => {
  try {
    await query('DELETE FROM saved_paths WHERE id = $1', [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete failed:', err.message);
    res.status(500).json({ error: "Couldn't delete this path" });
  }
});

//serve React files
app.use(express.static(clientDir));

//other URLs get react
app.use((req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

const PORT = process.env.PORT || 3001;
// Connect to Tiger Data first (if configured), then start the server
setupDatabase().finally(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
