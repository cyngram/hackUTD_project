# Orbit API

All routes start with `/api`. In React: `fetch('/api/...')`. Money is in whole dollars, already rounded.
Customers: `maria` and `jordan`.

## Home screen
| Route | Returns |
|---|---|
| `GET /customers` | The demo accounts (name, story, household, vehicle, plans, milestones) |
| `GET /customers/:id/overview` | `sections` (Accounts, Home, Vehicles cards), `creditScore` (value, label, utilization, payDownTo30), `health` (4 indicators), monthly income and expenses |
| `GET /customers/:id/moments` | `comingUp` (the next big moment), `nudges` (trend + treat), `cosmoPrompt` |
| `GET /customers/:id/budget` | Next 12 months: income, spending by category, left over, plans that month; `avgSpending`, `busiest` |

## Paths (the simulator)
`POST /simulate` with `{ customerId, assumptions }`. Every assumption is optional; the server fills in the customer's real values.

| Assumption | Meaning |
|---|---|
| `gasPrice` | $ per gallon |
| `monthlyIncome` | Projected monthly income |
| `surpriseRepair` | One-time expense in month 1 (a repair or a treat) |
| `plans` | `[{ label, amount (+income / -expense), month (0 = Jan), repeat (true = every year) }]` |
| `milestones` | `[{ label, kind (home / trip / opportunity / goal), amount, targetMonth (months from now) }]` |
| `weeklyMiles`, `currentMileage`, `lastOilChangeMiles` | Driving details that set the service schedule |

Returns `recommendation` (`headline`, `nextStep`), `smallShift` (a tip), `assumptions` (the values used) and `options`, one per path:
`label`, `recommended`, `why`, `monthly` (car payment, insurance, maintenance, gas, total), `fiveYear` (cash out, car value after, true cost),
`forecast` (61 months of `{ month, balance, carValue, loanBalance, net, events }`), `milestones` (status per goal),
`nextService`, `stress` (lowest savings point, `holdsUp`).

## Cosmo
`POST /chat` with `{ customerId, message, history: [{ role: 'user' | 'cosmo', text }], assumptions }`.
Returns `{ reply, source: 'gemini' | 'fallback' }`. Cosmo only explains numbers the engine computed. "Can I afford $X?"
questions get an affordability check computed on the server first.

## Saved paths (Tiger Data)
| Route | What it does |
|---|---|
| `GET /db/status` | `{ enabled }`. The Save button hides when the database isn't connected |
| `POST /paths` | Save `{ customerId, optionId, name, assumptions }`. The server re-runs the simulation and stores the forecast in a TimescaleDB hypertable |
| `GET /customers/:id/saved-paths` | Saved paths, newest first |
| `GET /saved-paths/compare?ids=1,2&bucket=month\|quarter` | Forecasts grouped with `time_bucket` |
| `DELETE /saved-paths/:id` | Delete a saved path and its forecast |
