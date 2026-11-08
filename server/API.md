# Orbit API (for the frontend)

All routes start with `/api`. In React, call them with `fetch('/api/...')`.

## GET /api/customers
The two demo customers (for the picker cards).
Useful fields: `id`, `name`, `shortName`, `age`, `household`, `story`, `vehicle.model`.

## GET /api/customers/:id/overview
"Today" dashboard for one customer (`maria` or `jordan`). Matches the dashboard boxes:
- `accounts`: list of { label, amount, note? }  -> Accounts box (Checking, Savings, Credit card)
- `home`: list of { label, amount, note }        -> Home box (Rent or Mortgage, Utilities)
- `vehicle`: { model, status, mileage, items: [{ label, amount, note }] } -> Vehicles box
- `creditScore`: { value, status, label }        -> the big credit score gauge
- `monthlyIncome`, `monthlyExpenses`, `breakdown`
- `health`: list of 4 gauges, each { label, display, status, tip }
  - status is "strong" (green), "okay" (yellow) or "low" (red)

## POST /api/simulate
Compares every option for one customer.

Body:
```json
{ "customerId": "maria", "assumptions": { "gasPrice": 2.8, "incomeGapMonths": 0, "surpriseRepair": 0 } }
```
(`assumptions` is optional. Use it for the stress-test sliders.)

Returns:
- `recommendation`: { optionId, headline, reason, nextStep }  -> the big "our pick" card
- `options`: one entry per choice, each with
  - `label`, `perk`, `why`, `recommended` (true/false)
  - `monthly`: { carPayment, insurance, maintenance, gas, totalCar }
  - `upfront`, `leftoverPerMonth`
  - `fiveYear`: { cashOut, carValueAfter, netCost }
  - `health`: same 4 gauges as overview
  - `stress`: { savingsAfter, holdsUp }
  - `loan`: { financed, apr, termMonths, totalInterest } or null

All money values are whole dollars, already rounded.

## POST /api/chat  (Cosmo)
Body:
```json
{ "customerId": "maria", "message": "What should I do when my lease ends?",
  "history": [ { "role": "user", "text": "..." }, { "role": "cosmo", "text": "..." } ],
  "assumptions": { "gasPrice": 3.5 } }
```
Returns `{ "reply": "...", "source": "gemini" | "fallback" }`.
Keep the conversation in React state and send it back as `history` each time.
If Gemini is down or no key is set, Cosmo still answers using our numbers (`source: "fallback"`).
