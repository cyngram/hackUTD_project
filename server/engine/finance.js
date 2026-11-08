// ============================================================
// Orbit finance engine
// All the math lives here as plain functions (no Express).
// The AI never does math - it only explains these results.
// ============================================================

const DEFAULTS = {
  gasPrice: 3.5, // $ per gallon
  incomeGapMonths: 0, // stress test: months with no income
  surpriseRepair: 0, // stress test: unexpected bill ($)
  goalAmount: 0,
  goalMonths: 0,
};

const YEARS = 5;
const MONTHS = YEARS * 12;

// ---------- small helpers ----------
const round = (n) => Math.round(n);
const money = (n) => `$${round(n).toLocaleString("en-US")}`;
const pct = (n) => `${(n * 100).toFixed(0)}%`;

// ---------- core formulas ----------

// Fixed monthly loan payment (standard amortization formula)
export function monthlyPayment(principal, aprPercent, months) {
  if (!months || principal <= 0) return 0;
  const r = aprPercent / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

// Monthly gas cost for a daily commute
export function monthlyGasCost(dailyMiles, mpg, gasPrice) {
  if (!mpg) return 0;
  return ((dailyMiles * 30) / mpg) * gasPrice;
}

// Credit card minimum payment (about 3% of the balance, at least $25)
function cardMinimum(balance) {
  if (balance <= 0) return 0;
  return Math.max(25, balance * 0.03);
}

// ---------- health scores ----------
// Each score comes back ready to display: value, label, status, tip.
function healthScores({
  income,
  monthlyExpenses,
  debtPayments,
  savings,
  cardBalance,
  cardLimit,
}) {
  const leftover = income - monthlyExpenses;
  const runway = monthlyExpenses > 0 ? savings / monthlyExpenses : 0;
  const dti = debtPayments / income;
  const utilization = cardLimit > 0 ? cardBalance / cardLimit : 0;
  const savingsRate = leftover / income;

  return [
    {
      key: "runway",
      label: "Emergency fund",
      value: Number(runway.toFixed(1)),
      display: `${runway.toFixed(1)} months`,
      status: runway >= 6 ? "strong" : runway >= 3 ? "okay" : "low",
      tip: "How long your savings would cover your bills. 3-6 months is a healthy goal.",
    },
    {
      key: "dti",
      label: "Debt-to-income",
      value: Number((dti * 100).toFixed(1)),
      display: pct(dti),
      status: dti <= 0.36 ? "strong" : dti <= 0.43 ? "okay" : "low",
      tip: "How much of your income goes to housing and debt. Lenders like 36% or less.",
    },
    {
      key: "utilization",
      label: "Credit card use",
      value: Number((utilization * 100).toFixed(1)),
      display: pct(utilization),
      status:
        utilization <= 0.3 ? "strong" : utilization <= 0.5 ? "okay" : "low",
      tip: "How much of your card limit you use. Under 30% helps your credit score.",
    },
    {
      key: "savingsRate",
      label: "Left over each month",
      value: Number((savingsRate * 100).toFixed(1)),
      display: `${money(leftover)} (${pct(savingsRate)})`,
      status:
        savingsRate >= 0.15 ? "strong" : savingsRate >= 0.05 ? "okay" : "low",
      tip: "What is left after all bills. Saving 15% or more is a strong habit.",
    },
  ];
}

// ---------- one option ----------
function simulateOption(customer, option, a) {
  const income = customer.monthlyIncome;
  const baseExpenses =
    customer.housing + customer.utilities + customer.otherExpenses;
  const cardMin = cardMinimum(customer.cardBalance);

  // Car payment for this option
  let carPayment = 0;
  let paymentMonths = 0;
  let financed = 0;
  if (option.type === "finance") {
    financed = Math.max(
      option.price - (option.tradeIn || 0) - (option.upfront || 0),
      0,
    );
    carPayment = monthlyPayment(financed, option.apr, option.termMonths);
    paymentMonths = Math.min(option.termMonths, MONTHS);
  } else if (option.type === "lease") {
    carPayment = option.leasePayment;
    paymentMonths = MONTHS; // assume you keep leasing for the whole 5 years
  }

  const gas = monthlyGasCost(
    customer.dailyCommuteMiles,
    option.mpg,
    a.gasPrice,
  );
  const carMonthly = carPayment + option.insurance + option.maintenance + gas;

  const monthlyExpenses = baseExpenses + carMonthly + cardMin;
  const debtPayments = customer.housing + carPayment + cardMin;
  const savingsAfter = customer.savings - (option.upfront || 0);

  const health = healthScores({
    income,
    monthlyExpenses,
    debtPayments,
    savings: savingsAfter,
    cardBalance: customer.cardBalance,
    cardLimit: customer.cardLimit,
  });

  // 5-year true cost = everything you pay + the trade-in you give up - what the car is worth after
  const runningCosts = (option.insurance + option.maintenance + gas) * MONTHS;
  const cashOut =
    (option.upfront || 0) + carPayment * paymentMonths + runningCosts;
  const netCost = cashOut + (option.tradeIn || 0) - (option.valueIn5Years || 0);

  // Stress test: surprise bill + months without income come out of savings
  const stressHit = a.surpriseRepair + a.incomeGapMonths * monthlyExpenses;
  const savingsAfterStress = savingsAfter - stressHit;

  const forecast = [{ month: 0, balance: round(savingsAfter) }]; // start at "today"
  let balance = savingsAfter;
  for (let month = 1; month <= MONTHS; month += 1) {
    const monthlyIncome = month <= a.incomeGapMonths ? 0 : income;
    const payment = month <= paymentMonths ? carPayment : 0; // loan ends → payment stops
    const monthlyCost = baseExpenses + (carMonthly - carPayment) + payment + cardMin + (month === 1 ? a.surpriseRepair : 0);
    balance += monthlyIncome - monthlyCost;
    forecast.push({ month, balance: round(balance) });
  }

  //when saving more than goal
  let goal = null;
  if (a.goalAmount > 0) {
    const start = forecast[0].balance;
    const hit = forecast.find((point) => point.balance - start >= a.goalAmount);
    goal = {
      amount: a.goalAmount,
      months: a.goalMonths,
      reachedMonth: hit ? hit.month : null,      // null = not within 5 years
      onTrack: hit ? hit.month <= a.goalMonths : false,
    };
  }

  return {
    id: option.id,
    type: option.type,
    label: option.label,
    perk: option.perk,
    upfront: round(option.upfront || 0),
    monthly: {
      carPayment: round(carPayment),
      insurance: round(option.insurance),
      maintenance: round(option.maintenance),
      gas: round(gas),
      totalCar: round(carMonthly),
    },
    loan:
      option.type === "finance"
        ? {
            financed: round(financed),
            apr: option.apr,
            termMonths: option.termMonths,
            totalInterest: round(carPayment * option.termMonths - financed),
          }
        : null,
    leftoverPerMonth: round(income - monthlyExpenses),
    fiveYear: {
      cashOut: round(cashOut),
      carValueAfter: round(option.valueIn5Years || 0),
      netCost: round(netCost),
    },
    health,
    forecast,
    goal,
    stress: {
      savingsAfter: round(savingsAfterStress),
      holdsUp: savingsAfterStress >= 0,
    },
  };
}

// ---------- the whole simulation ----------
export function simulate(customer, assumptions = {}) {
  const a = { ...DEFAULTS, ...assumptions };
  const results = customer.options.map((o) => simulateOption(customer, o, a));

  // Recommendation: lowest 5-year true cost among options you can afford monthly.
  // If the stress test is on, prefer options that survive it.
  const stressOn = a.incomeGapMonths > 0 || a.surpriseRepair > 0;
  let pool = results.filter((r) => r.leftoverPerMonth >= 0);
  if (stressOn && pool.some((r) => r.stress.holdsUp))
    pool = pool.filter((r) => r.stress.holdsUp);
  if (pool.length === 0) pool = results;
  const best = pool.reduce((x, y) =>
    y.fiveYear.netCost < x.fiveYear.netCost ? y : x,
  );

  const cheapestMonthly = results.reduce((x, y) =>
    y.monthly.totalCar < x.monthly.totalCar ? y : x,
  );

  // A plain-language "why" for every option
  for (const r of results) {
    const diff = r.fiveYear.netCost - best.fiveYear.netCost;
    const parts = [];
    if (r.id === best.id)
      parts.push(
        `Lowest true cost over ${YEARS} years (${money(r.fiveYear.netCost)}).`,
      );
    else
      parts.push(
        `Costs about ${money(diff)} more than the top pick over ${YEARS} years.`,
      );
    if (r.id === cheapestMonthly.id) parts.push("Lowest monthly cost.");
    if (r.monthly.gas < cheapestMonthly.monthly.gas)
      parts.push(`Saves on gas (${money(r.monthly.gas)}/mo).`);
    if (r.leftoverPerMonth < 0)
      parts.push("Costs more than you bring in each month.");
    if (stressOn && !r.stress.holdsUp)
      parts.push("Would drain your savings in the stress test.");
    r.why = parts.join(" ");
    r.recommended = r.id === best.id;
  }

  return {
    customerId: customer.id,
    assumptions: a,
    options: results,
    recommendation: {
      optionId: best.id,
      headline: `Our pick for ${customer.shortName || customer.name}: ${best.label}`,
      reason: best.why,
      nextStep: nextStepFor(best),
    },
  };
}

// Credit score label (FICO-style ranges)
function creditLabel(score) {
  if (score >= 740) return { status: "strong", label: "Very good" };
  if (score >= 670) return { status: "okay", label: "Good" };
  return { status: "low", label: "Fair" };
}

// The "today" picture for the overview dashboard
// Sections match the dashboard: Accounts, Home, Vehicles, Credit score
export function overview(customer) {
  const v = customer.vehicle;
  const cardMin = cardMinimum(customer.cardBalance);
  const gas = monthlyGasCost(
    customer.dailyCommuteMiles,
    v.mpg,
    DEFAULTS.gasPrice,
  );
  const carMonthly = v.payment + v.insurance + v.maintenance + gas;
  const monthlyExpenses =
    customer.housing +
    customer.utilities +
    customer.otherExpenses +
    carMonthly +
    cardMin;
  const credit = creditLabel(customer.creditScore);
  const housingLabel =
    customer.housingType === "mortgage" ? "Mortgage" : "Rent";
  const vehicleStatus =
    v.type === "lease"
      ? `Lease ends in ${v.monthsLeft} months`
      : v.type === "owned"
        ? "Paid off"
        : "Financed";

  return {
    customerId: customer.id,
    name: customer.name,
    monthlyIncome: round(customer.monthlyIncome),
    monthlyExpenses: round(monthlyExpenses),
    accounts: [
      { label: "Checking", amount: round(customer.checking || 0) },
      { label: "Savings", amount: round(customer.savings) },
      {
        label: "Credit card balance",
        amount: round(customer.cardBalance),
        note: `of ${money(customer.cardLimit)} limit`,
      },
    ],
    home: [
      {
        label: housingLabel,
        amount: round(customer.housing),
        note: "per month",
      },
      {
        label: "Utilities",
        amount: round(customer.utilities),
        note: "per month",
      },
    ],
    vehicle: {
      model: v.model,
      status: vehicleStatus,
      mileage: v.mileage,
      items: [
        {
          label: v.type === "lease" ? "Lease payment" : "Car payment",
          amount: round(v.payment),
          note: "per month",
        },
        { label: "Insurance", amount: round(v.insurance), note: "per month" },
        { label: "Gas", amount: round(gas), note: "per month" },
      ],
    },
    creditScore: { value: customer.creditScore, ...credit },
    breakdown: {
      housing: round(customer.housing),
      utilities: round(customer.utilities),
      car: round(carMonthly),
      cardMinimum: round(cardMin),
      everythingElse: round(customer.otherExpenses),
    },
    health: healthScores({
      income: customer.monthlyIncome,
      monthlyExpenses,
      debtPayments: customer.housing + v.payment + cardMin,
      savings: customer.savings,
      cardBalance: customer.cardBalance,
      cardLimit: customer.cardLimit,
    }),
  };
}

function nextStepFor(option) {
  if (option.id === "keep")
    return "Book the service appointment and keep saving toward your next car.";
  if (option.type === "lease")
    return "Ask your dealer about current lease offers.";
  return "Get a trade-in appraisal and check your pre-approved rate.";
}
