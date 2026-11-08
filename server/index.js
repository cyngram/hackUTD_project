import 'dotenv/config';            // loads GEMINI_API_KEY from .env
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url'; 
import fs from 'fs';
import { simulate, overview, moments, affordability } from './engine/finance.js';
import { askCosmo } from './engine/cosmo.js';

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
  for (const key of ['gasPrice', 'incomeGapMonths', 'surpriseRepair', 'goalAmount', 'goalMonths', 'monthlyIncome']) {
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
      }))
      .filter((plan) =>
        plan.label &&
        Number.isFinite(plan.amount) && Math.abs(plan.amount) <= 100000 &&
        Number.isInteger(plan.month) && plan.month >= 0 && plan.month <= 11);
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
// Body: { customerId: "maria", assumptions: { gasPrice, incomeGapMonths, surpriseRepair } }
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
  const result = await askCosmo({ customer, overview: overview(customer), sim, message, history, afford });
  res.json(result);
});

//serve React files
app.use(express.static(clientDir));

//other URLs get react
app.use((req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});