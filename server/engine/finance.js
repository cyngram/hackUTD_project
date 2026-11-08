// ============================================================
// Orbit finance engine
// All the math lives here as plain functions (no Express).
// The AI never does math - it only explains these results.
// ============================================================

const DEFAULTS = {
  gasPrice: 3.5, // $ per gallon
  surpriseRepair: 0, // what-if: one-time expense (repair or treat), paid in month 1
  monthlyIncome: null,   // what-if: projected monthly income (null = their real income)
  plans: null,           // their planned events (null = the plans saved for this customer)
  milestones: null,      // life goals: home, trips, new opportunities (null = their saved milestones)
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

// How far they drive: their weekly miles (default: commute on workdays + about 80 miles of errands)
export function weeklyMilesFor(customer) {
  return customer.weeklyMiles ?? Math.round(customer.dailyCommuteMiles * 5 + 80);
}

// Monthly gas cost from miles driven per month
export function monthlyGasCost(monthlyMiles, mpg, gasPrice) {
  if (!mpg) return 0;
  return (monthlyMiles / mpg) * gasPrice;
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
  const income = a.monthlyIncome;   // projected income (defaults to their real income)
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

  // ---- Miles drive the service schedule (Toyota's maintenance schedules go by mileage, not months) ----
  const monthlyMiles = (a.weeklyMiles * 52) / 12;
  const usesCurrentCar = option.startMiles === "current";            // buying out / keeping the car they have
  const startMiles = usesCurrentCar ? a.currentMileage : option.startMiles ?? 0;
  const monthAt = (odometer) => Math.max(1, Math.ceil((odometer - startMiles) / monthlyMiles));
  const included = option.includedMaintenance;                       // e.g. new Toyotas: 2 years / 25,000 miles
  const isCovered = (month, odometer) =>
    Boolean(included) && month <= included.months && odometer - startMiles <= included.miles;

  const gas = monthlyGasCost(monthlyMiles, option.mpg, a.gasPrice);
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
  // Big service items on this path's schedule (tires, brakes, major services)
  // Oil changes every N miles (their last oil change sets the first one on the car they already have)
  const oilChanges = [];
  if (option.type !== "lease") {
    const interval = option.oilInterval ?? 10000;
    let next = usesCurrentCar ? a.lastOilChangeMiles + interval : startMiles + interval;
    while (monthAt(next) <= MONTHS) {
      const month = monthAt(next);
      oilChanges.push({ label: "Oil change", atMiles: next, month, amount: isCovered(month, next) ? 0 : option.oilCost ?? 90 });
      next += interval;
    }
  }
  // Bigger services (tires, brakes, major services) at their mileage
  const bigServices = (option.serviceEvents || []).map((e) => {
    const month = e.atMiles != null ? monthAt(e.atMiles) : e.month;
    return { ...e, month, amount: isCovered(month, e.atMiles ?? startMiles) ? 0 : (Number(e.amount) || 0) };   // a missing amount counts as $0 instead of breaking the math
  });
  const services = [...oilChanges, ...bigServices]
    .filter((e) => e.month >= 1 && e.month <= MONTHS && !(e.atMiles != null && e.atMiles <= startMiles && !usesCurrentCar))
    .sort((x, y) => x.month - y.month);
  const serviceTotal = services.reduce((total, e) => total + e.amount, 0);
  const cashOut =
    (option.upfront || 0) + carPayment * paymentMonths + runningCosts + serviceTotal;
  // "keep" also uses up the car you already own, so count its value like a trade-in
  const netCost =
    cashOut + (option.tradeIn || 0) + (option.type === "keep" ? option.valueToday || 0 : 0) - (option.valueIn5Years || 0);

  // ---- What you'd own over time: savings + car value - what you still owe ----
  const valueToday = option.valueToday ?? option.price ?? 0;   // a new car is worth its price on day one
  const valueLater = option.valueIn5Years ?? 0;
  const carValueAt = (month) => {
    const t = Math.min(month / MONTHS, 1);
    return valueLater + (valueToday - valueLater) * Math.pow(1 - t, 1.5);   // cars lose value fastest early on
  };
  const monthlyRate = (option.apr || 0) / 100 / 12;
  const pattern = customer.spendingPattern;   // 12 numbers (Jan..Dec) from their bank history (optional)
  const startMonth = new Date().getMonth();

  let balance = savingsAfter;                 // cash in savings
  let loanBalance = financed;                 // what's still owed on the car
  const point = (month, events = []) => ({
    month,
    events,                                   // what happens this month (plans, services)
    balance: round(balance),
    carValue: round(carValueAt(month)),
    loanBalance: round(loanBalance),
    net: round(balance + carValueAt(month) - loanBalance),   // "what you'd own"
  });

  const forecast = [point(0)];
  for (let month = 1; month <= MONTHS; month += 1) {
    const payment = month <= paymentMonths ? carPayment : 0;
    const seasonal = pattern ? pattern[(startMonth + month) % 12] : 1;   // e.g. December runs higher
    const monthlyCost =
      baseExpenses + customer.otherExpenses * (seasonal - 1) +   // everyday spending, adjusted by season
      (carMonthly - carPayment) + payment + cardMin +
      (month === 1 ? a.surpriseRepair : 0);
    // Their plans repeat every year in that calendar month; services happen once on this path's schedule
    const calendarMonth = (startMonth + month) % 12;
    // repeat: false = a one-time plan, so it only counts the first time that month comes around
    const plansNow = a.plans.filter((plan) => plan.month === calendarMonth && (plan.repeat !== false || month <= 12));
    const servicesNow = services.filter((e) => e.month === month);
    const events = [
      ...plansNow.map((plan) => ({ label: plan.label, amount: plan.amount })),
      ...servicesNow.map((e) => ({ label: e.label, amount: -e.amount })),
      ...(month === 1 && a.surpriseRepair > 0 ? [{ label: "One-time expense", amount: -a.surpriseRepair }] : []),
    ];
    balance += income - monthlyCost +
      plansNow.reduce((total, plan) => total + plan.amount, 0) -
      servicesNow.reduce((total, e) => total + e.amount, 0);
    if (option.type === "finance" && month <= paymentMonths) {
      loanBalance = Math.max(0, loanBalance * (1 + monthlyRate) - carPayment);   // interest first, then payment
    }
    forecast.push(point(month, events));
  }

  // Does savings ever drop below $0? (the honest version of "does this path hold up")
  const lowPoint = forecast.reduce((low, p) => (p.balance < low.balance ? p : low), forecast[0]);

  // Milestones (home down payment, a big trip, grad school…), saved up in order of their target dates.
  // Each one needs everything before it PLUS its own amount, so two goals never count the same dollars.
  // Progress = new savings on top of what they have today (today's savings stay as their cushion).
  let needed = 0;
  const milestones = [...a.milestones]
    .sort((x, y) => x.targetMonth - y.targetMonth)
    .map((m) => {
      needed += m.amount;
      const hit = forecast.find((p) => p.balance - customer.savings >= needed);
      return {
        label: m.label,
        kind: m.kind || "goal",
        amount: m.amount,
        targetMonth: m.targetMonth,
        target: monthYear(m.targetMonth),
        reachedMonth: hit ? hit.month : null,      // null = not within 5 years
        reached: hit ? monthYear(hit.month) : null,
        onTrack: hit ? hit.month <= m.targetMonth : false,
      };
    });

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
    milestones,
    nextService: services[0] ? { ...services[0], when: monthYear(services[0].month) } : null,
    stress: {
      savingsAfter: lowPoint.balance,          // lowest savings balance in the forecast
      lowMonth: lowPoint.month,
      holdsUp: lowPoint.balance >= 0,
    },
  };
}

// ---------- the whole simulation ----------
export function simulate(customer, assumptions = {}) {
  const a = { ...DEFAULTS, ...assumptions };
  a.monthlyIncome = a.monthlyIncome ?? customer.monthlyIncome;
  a.plans = a.plans ?? customer.plans ?? [];
  a.milestones = a.milestones ?? customer.milestones ?? [];
  a.weeklyMiles = a.weeklyMiles ?? weeklyMilesFor(customer);
  a.currentMileage = a.currentMileage ?? customer.vehicle.mileage;
  a.lastOilChangeMiles = a.lastOilChangeMiles ?? customer.vehicle.lastOilChangeMiles ?? a.currentMileage;
  const results = customer.options.map((o) => simulateOption(customer, o, a));

  // Recommendation: lowest 5-year true cost among options you can afford monthly.
  // If the stress test is on, prefer options that survive it.
  // Prefer paths where savings never drop below $0.
  let pool = results.filter((r) => r.leftoverPerMonth >= 0);
  if (pool.some((r) => r.stress.holdsUp))
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
    if (!r.stress.holdsUp)
      parts.push(`Savings dip below $0 around ${monthYear(r.stress.lowMonth)}.`);
    r.why = parts.join(" ");
    r.recommended = r.id === best.id;
  }

  // "A small shift goes a long way": trim their biggest planned expense by a third
  const biggest = a.plans.filter((plan) => plan.amount < 0).sort((x, y) => x.amount - y.amount)[0];
  const trim = biggest ? Math.round(Math.abs(biggest.amount) / 3 / 50) * 50 : 0;
  const smallShift = biggest && trim > 0
    ? `Trimming ${biggest.label.toLowerCase()} by ${money(trim)} would put you ${money(trim)} further ahead every year.`
    : null;

  return {
    customerId: customer.id,
    assumptions: a,
    smallShift,
    options: results,
    recommendation: {
      optionId: best.id,
      headline: `Our pick for ${customer.shortName || customer.name}: ${best.label}`,
      reason: best.why,
      nextStep: nextStepFor(best, customer),
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
  const gas = monthlyGasCost((weeklyMilesFor(customer) * 52) / 12, v.mpg, DEFAULTS.gasPrice);
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

  // Each item says what it IS (kind), so the frontend can pick an icon without guessing.
  const accounts = [
    { kind: "checking", label: "Checking", amount: round(customer.checking || 0) },
    { kind: "savings", label: "Savings", amount: round(customer.savings) },
    {
      kind: "credit",
      label: "Credit card balance",
      amount: round(customer.cardBalance),
      note: `of ${money(customer.cardLimit)} limit`,
    },
  ];
  const home = [
    { kind: "housing", label: housingLabel, amount: round(customer.housing), note: "per month" },
    { kind: "utilities", label: "Utilities", amount: round(customer.utilities), note: "per month" },
  ];
  const vehicleItems = [
    {
      kind: "payment",
      label: v.type === "lease" ? "Lease payment" : "Car payment",
      amount: round(v.payment),
      note: "per month",
    },
    { kind: "insurance", label: "Insurance", amount: round(v.insurance), note: "per month" },
    { kind: "gas", label: "Gas", amount: round(gas), note: "per month" },
  ];
  if (v.maintenance > 0) {
    vehicleItems.push({ kind: "maintenance", label: "Maintenance", amount: round(v.maintenance), note: "per month" });
  }
  const sum = (items) => items.reduce((total, item) => total + item.amount, 0);

  return {
    customerId: customer.id,
    name: customer.name,
    monthlyIncome: round(customer.monthlyIncome),
    monthlyExpenses: round(monthlyExpenses),
    accounts,
    home,
    vehicle: {
      model: v.model,
      status: vehicleStatus,
      mileage: v.mileage,
      items: vehicleItems,
    },
    // The 3 "Everything in one place" cards, ready to display
    sections: [
      {
        id: "accounts", title: "Accounts", eyebrow: "Your money", icon: "wallet", accent: "blue",
        total: round(customer.checking || 0) + round(customer.savings),   // cash only (card balance is owed)
        unit: "",
        items: accounts,
      },
      {
        id: "home", title: "Home", eyebrow: "Your place", icon: "home", accent: "sand",
        total: sum(home),
        unit: "/mo",
        items: home,
      },
      {
        id: "vehicles", title: "Vehicles", eyebrow: "Your ride", icon: "car", accent: "green",
        total: sum(vehicleItems),
        unit: "/mo",
        items: [{ kind: "car", label: v.model, amount: null, note: vehicleStatus }, ...vehicleItems],
      },
    ],
    creditScore: {
      value: customer.creditScore,
      ...credit,
      utilization: Math.round((customer.cardBalance / customer.cardLimit) * 100),          // % of card limit used
      payDownTo30: Math.max(0, round(customer.cardBalance - customer.cardLimit * 0.3)),   // $ to get under 30%
    },
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

// The one clear next step for the recommended path
function nextStepFor(option, customer) {
  const original = customer.options.find((o) => o.id === option.id) || {};
  const leasing = customer.vehicle.type === 'lease';

  if (option.type === 'keep')
    return 'Book the service appointment and keep saving toward your next car.';
  if (option.type === 'lease')
    return 'Ask your dealer about current lease offers before your lease ends.';
  if (leasing && option.id === 'buyout')
    return 'Ask your leasing company for your buyout quote, then compare it with a pre-approved loan rate.';
  if (leasing)
    return 'Ask your dealer about lease-end trade-up offers and get pre-approved for financing.';
  if (original.tradeIn > 0)
    return 'Get a trade-in appraisal and check your pre-approved rate.';
  return 'Get pre-approved for financing so you know your rate before you shop.';
}

// ---------- What-ifs for Cosmo ----------
// Re-runs our pick with one change at a time, so Cosmo explains real numbers instead of guessing.
// Works for any customer: every milestone gets a "push back a year" run, plus one "hold off on big costs" run.
export function scenarios(customer, assumptions = {}) {
  const base = simulate(customer, assumptions);
  const pick = base.options.find((o) => o.recommended);
  const a = base.assumptions;
  const summarize = (label, o) => ({
    label,
    lowest: o.stress.savingsAfter,
    holdsUp: o.stress.holdsUp,
    in5Years: o.forecast[60].net,
    milestones: o.milestones,
  });
  const run = (label, change) =>
    summarize(label, simulate(customer, { ...a, ...change }).options.find((o) => o.id === pick.id));

  const bigCosts = a.plans.filter((plan) => plan.amount <= -200);   // "big purchases" = planned costs of $200+
  return {
    path: pick.label,
    today: summarize("As planned today", pick),
    changes: [
      // Pushed goals go last in line, so the goals still due sooner get saved for first
      ...a.milestones.map((m) =>
        run(`Push "${m.label}" back a year`, {
          milestones: [...a.milestones.filter((x) => x !== m), { ...m, targetMonth: m.targetMonth + 12 }],
        })),
      ...(bigCosts.length
        ? [run(`Hold off on big planned costs (${bigCosts.map((plan) => plan.label).join(", ")})`, {
            plans: a.plans.filter((plan) => !bigCosts.includes(plan)),
          })]
        : []),
    ],
  };
}

// ---------- "Coming up" + nudges for the home screen ----------
// The date a number of months from now. Starts from the 1st so adding months
// never skips one (Jan 31 + 1 month would otherwise land in March).
function monthsFromNowDate(monthsFromNow) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + monthsFromNow);
  return d;
}

// Always with the year: "March 2027" (charts, milestones, service dates)
function monthYear(monthsFromNow) {
  return monthsFromNowDate(monthsFromNow).toLocaleString("en-US", { month: "long", year: "numeric" });
}

// Friendly text: "April" if it's this year, "April 2027" if it isn't
function monthName(monthsFromNow) {
  const d = monthsFromNowDate(monthsFromNow);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString("en-US", sameYear ? { month: "long" } : { month: "long", year: "numeric" });
}

// "about 8 months" / "about 3 years" so long waits are easy to picture
function howLong(months) {
  if (months < 12) return `about ${months} month${months === 1 ? "" : "s"}`;
  const years = Math.round(months / 12);
  return `about ${years} year${years === 1 ? "" : "s"}`;
}

export function moments(customer) {
  const v = customer.vehicle;
  const carName = v.model.split(' ').slice(-1)[0];       // "2023 Toyota Corolla" → "Corolla"
  const today = overview(customer);
  const leftover = today.monthlyIncome - today.monthlyExpenses;

  // How much the best path saves vs the next best (for the headline)
  const sim = simulate(customer);
  const costs = sim.options.map((o) => o.fiveYear.netCost).sort((x, y) => x - y);
  const savesUpTo = costs.length > 1 ? costs[1] - costs[0] : 0;
  const pathsText = `You have ${sim.options.length} paths. One could save you about ${money(savesUpTo)} over 5 years.`;

  // 1) The upcoming moment
  const comingUp = [];
  if (v.type === 'lease' && v.monthsLeft <= 6) {
    comingUp.push({
      when: `In ${v.monthsLeft} months`,
      title: `Your ${carName} lease ends in ${monthName(v.monthsLeft)}`,
      detail: pathsText,
    });
  } else if (v.mileage >= 100000) {
    comingUp.push({
      when: 'Soon',
      title: `Your ${carName} is due for its ${Math.ceil(v.mileage / 10000) * 10}k service`,
      detail: pathsText,
    });
  }

  // 2) Nudges based on current trends
  const nudges = [];
  const runway = customer.savings / today.monthlyExpenses;
  const target = runway < 3 ? 3 : 6;                      // next emergency-fund milestone
  if (runway < 6 && leftover > 0) {
    const months = Math.ceil((target * today.monthlyExpenses - customer.savings) / leftover);
    nudges.push({
      type: 'trend',
      title: 'If your trend holds',
      // Show the math in plain words: what you save, what you're aiming for, and when you get there
      text: `Saving about ${money(leftover)} a month, you'll have ${target} months of bills `
        + `(${money(target * today.monthlyExpenses)}) set aside by ${monthName(months)}, ${howLong(months)} from now.`
        + (months > 24
          ? " Trimming a little each month gets you there sooner."
          : target === 3 ? " Then it's treat-yourself time." : ""),
    });
  } else {
    nudges.push({
      type: 'trend',
      title: 'Strong cushion',
      text: `Your savings cover ${runway.toFixed(1)} months of bills. Nice work.`,
    });
  }
  // Treat yourself: only when the safety cushion is 3+ months (never encourage spending money you need)
  if (runway >= 3 && leftover > 0) {
    const budget = Math.min(3000, Math.floor((leftover * 0.3 * 6) / 100) * 100);   // capped at $3,000
    const roundTo100 = (n) => Math.round(n / 100) * 100;
    nudges.push({
      type: 'treat',
      title: "You've earned it",
      text: `You've worked hard, ${customer.shortName || customer.name}. You have room for about ${money(budget)} to treat yourself without touching your safety cushion.`,
      budget,
      ideas: [
        { label: 'A trip', amount: budget },
        { label: 'Something new', amount: roundTo100(budget * 0.5) },
        { label: 'A night out', amount: roundTo100(budget * 0.2) },
        { label: 'Save it', amount: 0 },
      ],
    });
  }

  return {
    customerId: customer.id,
    comingUp,
    nudges,
    cosmoPrompt: 'Considering my current state, can I afford ',   // suggested prompt for the chat box
  };
}

// ---------- "Can I afford it?" check (used by Cosmo) ----------
// Treats the purchase as a one-time expense paid from savings today.
export function affordability(customer, amount) {
  const today = overview(customer);
  const expenses = today.monthlyExpenses;
  const leftover = today.monthlyIncome - expenses;
  const savingsAfter = customer.savings - amount;
  const runwayBefore = customer.savings / expenses;
  const runwayAfter = savingsAfter / expenses;

  let verdict = 'not yet';
  if (savingsAfter >= 0 && runwayAfter >= 3) verdict = 'comfortable';
  else if (savingsAfter >= 0 && runwayAfter >= 1.5) verdict = 'tight';

  const monthsToRecover = leftover > 0 ? Math.ceil(amount / leftover) : null;
  // If not comfortable: how long to save so you can buy it AND keep a 3-month cushion
  const saveFirstMonths = leftover > 0
    ? Math.max(0, Math.ceil((amount + 3 * expenses - customer.savings) / leftover))
    : null;

  return {
    amount: round(amount),
    verdict,
    savingsBefore: round(customer.savings),
    savingsAfter: round(savingsAfter),
    runwayBefore: Number(runwayBefore.toFixed(1)),
    runwayAfter: Number(runwayAfter.toFixed(1)),
    monthsToRecover,
    recoverBy: monthsToRecover !== null ? monthName(monthsToRecover) : null,
    saveFirstMonths,
    saveFirstBy: saveFirstMonths !== null ? monthName(saveFirstMonths) : null,
  };
}

// ---------- Monthly budget breakdown (next 12 months, their current car) ----------
// Uses their bank-history spending pattern and their plans, so busy months (holidays, trips) show up.
export function budget(customer) {
  const v = customer.vehicle;
  const cardMin = cardMinimum(customer.cardBalance);
  const gas = monthlyGasCost((weeklyMilesFor(customer) * 52) / 12, v.mpg, DEFAULTS.gasPrice);
  const car = v.payment + v.insurance + v.maintenance + gas;
  const pattern = customer.spendingPattern;
  const plans = customer.plans ?? [];
  const startMonth = new Date().getMonth();

  const months = [];
  for (let m = 0; m < 12; m++) {
    const calendarMonth = (startMonth + m) % 12;
    const plansNow = plans.filter((plan) => plan.month === calendarMonth);
    const planSpending = plansNow.filter((p) => p.amount < 0).reduce((t, p) => t - p.amount, 0);
    const planIncome = plansNow.filter((p) => p.amount > 0).reduce((t, p) => t + p.amount, 0);
    const categories = [
      { key: "housing", label: customer.housingType === "mortgage" ? "Mortgage" : "Rent", amount: round(customer.housing) },
      { key: "utilities", label: "Utilities", amount: round(customer.utilities) },
      { key: "car", label: "Car (payment, insurance, gas)", amount: round(car) },
      { key: "everyday", label: "Everyday spending", amount: round(customer.otherExpenses * (pattern ? pattern[calendarMonth] : 1)) },
      { key: "card", label: "Credit card minimum", amount: round(cardMin) },
      ...(planSpending ? [{ key: "plans", label: plansNow.filter((p) => p.amount < 0).map((p) => p.label).join(", "), amount: round(planSpending) }] : []),
    ];
    const spending = categories.reduce((t, c) => t + c.amount, 0);
    const income = round(customer.monthlyIncome + planIncome);
    months.push({
      month: m,
      label: monthYear(m),
      income,
      spending,
      leftover: income - spending,
      categories,
      events: plansNow.map((p) => ({ label: p.label, amount: p.amount })),
    });
  }
  const avgSpending = round(months.reduce((t, x) => t + x.spending, 0) / 12);
  const busiest = months.reduce((a, b) => (b.spending > a.spending ? b : a));
  return { customerId: customer.id, months, avgSpending, busiest: { label: busiest.label, spending: busiest.spending } };
}
