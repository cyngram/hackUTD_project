# Orbit

**Keep your money in orbit.** A financial dashboard built around paths, not just numbers. Built at HackUTD 2026 for the **Toyota**, **PNC** and **Tiger Data (MLH)** tracks.

Most money tools show you one screen at a time: a loan quote here, a bank balance there. Orbit looks at your whole picture (accounts, budget, credit, and the goals you're saving for) and lays out your car options side by side. For every path you see a 5-year forecast, the true cost, when you'll reach your milestones, and when your next service is due based on how much you drive.

**Live demo:** https://hackutd-project.onrender.com (free hosting, so the first load can take a few seconds to wake up)

## What it does

- **Home dashboard:** accounts, credit score with a tip, financial health indicators, a 12-month budget, and what's coming up (like a lease ending or a big service).
- **Paths:** keep, trade, buy or lease, compared on monthly cost, 5-year true cost, a 60-month forecast chart, milestones and next service. Our pick is the lowest true cost among paths you can afford.
- **Make it yours:** what-ifs (gas price, income, a one-time expense), plans (a yearly bonus, a vacation), milestones (a home, a trip, an emergency fund) and your car's mileage.
- **Saved paths (Tiger Data):** save a path with your what-ifs and compare saved paths by month or quarter, with the gap between them at 1, 3 and 5 years.
- **Cosmo (Gemini):** a chat guide that explains your numbers in plain language. It answers "can I afford it?" and "what if I push my trip back?" with numbers the engine already calculated. Cosmo never does math itself.

### Demo customers

| Person | Situation | Our pick |
|---|---|---|
| Alex Rivera | Comfortable, Highlander lease ending soon | RAV4 Hybrid |
| Maya Patel | College student, tight budget, 2012 Corolla | Trade down to a 2016 Yaris |
| Dana Brooks | Paycheck to paycheck, drives a lot | Trade down to a used 2019 Prius |

Two different lives get two different plans.

## Tech stack

| Part | Tools |
|---|---|
| Frontend | React 19 + Vite (JavaScript), lucide-react icons, plain CSS designed in Figma Make (light and dark mode) |
| Backend | Node.js + Express 5 |
| Finance engine | Plain JavaScript in `server/engine/finance.js`: amortization, depreciation, mileage-based service, seasonal spending, 60-month forecasts |
| AI | Google Gemini (`generateContent` REST API) |
| Database | Tiger Data (TimescaleDB): saved forecasts live in a hypertable and are compared with `time_bucket` |
| Hosting | Render (one web service serves the API and the built frontend) |

## Project structure

```
client/                   React app
  src/App.jsx             Home dashboard
  src/components/         PathExplorer, ForecastChart, SavedPaths, CosmoPanel, BudgetPanel, InsightPanel
  src/lib/                Shared helpers: api, format (money, dates), forecast (fill months, gaps), icons
server/
  index.js                Express routes (see server/API.md)
  db.js                   Tiger Data connection and tables (optional: the app works without it)
  engine/finance.js       All the math
  engine/cosmo.js         Cosmo's rules, the data it gets, and backup answers
  data/customers.json     The demo customers
  API.md                  Every route and what it returns
```

## Run it locally

You need Node.js 20 or newer.

```bash
# 1. Backend (port 3001)
cd server
npm install
npm run dev

# 2. Frontend (port 5173), in a second terminal
cd client
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` requests to the backend.

### Environment variables

Create `server/.env` (it's gitignored, so never commit it):

```
GEMINI_API_KEY=your-key            # optional: without it, Cosmo uses backup answers
GEMINI_MODEL=gemini-3.5-flash      # optional: the model Cosmo uses
DATABASE_URL=postgres://...        # optional: Tiger Data connection string; without it, saved paths are hidden
PORT=3001                          # optional
```

Everything is optional, so the app runs with no keys at all.

## Deploy on Render

One Web Service from this repo:

- **Build command:** `cd client && npm install && npm run build && cd ../server && npm install`
- **Start command:** `cd server && node index.js`
- **Environment:** add `GEMINI_API_KEY` and `DATABASE_URL` (and `GEMINI_MODEL` if you want a different model)

Express serves the built frontend from `client/dist`.

## Editing the demo customers

Everything about a person lives in `server/data/customers.json`: income, savings, bills, car, the paths they can choose, plans and milestones. Change a number, save, and refresh. Add a new person and they appear in the account switcher automatically. Each service event needs a `label`, `atMiles` and `amount`.

## How the numbers work

- **True cost over 5 years** = cash out (upfront, payments, insurance, maintenance, gas, services) minus what the car is worth at the end. Keeping your current car still costs you the value it loses.
- **Forecast:** month by month for 60 months: income minus bills (adjusted for seasonal spending), car costs, plans and services, plus car value minus loan balance.
- **Milestones** are saved for in order of their target dates, so two goals never count the same dollars.
- **Does it hold up?** A path holds up if savings never drop below $0 in the forecast.

## Team

Built by Cynthia Guzman Ramirez and Logan Andrino at HackUTD 2026.
