import 'dotenv/config';            // loads GEMINI_API_KEY from .env
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url'; 
import fs from 'fs';
import { simulate, overview } from './engine/finance.js';
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
  for (const key of ['gasPrice', 'incomeGapMonths', 'surpriseRepair']) {
    const n = Number(assumptions?.[key]);
    if (assumptions?.[key] !== undefined && !Number.isNaN(n) && n >= 0) clean[key] = n;
  }
  return clean;
}

// List of customers (for the picker cards)
app.get('/api/customers', (req, res) => {
  res.json(loadCustomers());
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
  const result = await askCosmo({ customer, overview: overview(customer), sim, message, history });
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