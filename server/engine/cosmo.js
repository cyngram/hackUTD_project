// ============================================================
// Cosmo - Orbit's assistant
// Cosmo NEVER does its own math. We give it the numbers our
// engine computed, and it explains them in plain language.
// ============================================================

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

const RULES = `You are Cosmo, the friendly money guide inside Orbit, a Toyota + PNC financial dashboard.
Rules:
- Use ONLY the numbers in the DATA section. Never invent numbers. If something isn't in the data, say you don't know.
- Plain language for someone who is not a finance expert. Explain any term you use.
- Keep answers short: 3-6 sentences, or a few short bullets.
- When giving advice: give ONE clear recommendation, the main reason, and one or two other options with their trade-offs.
- End with a short follow-up question such as "Want to explore other options?"
- Be warm and honest. If every option has a risk, say so kindly.
- For "can I afford" questions, use the AFFORDABILITY CHECK in the data: answer clearly (yes / it's tight / not yet), say what it does to their savings cushion, then give exactly three ideas: (1) the full purchase, (2) a scaled-down version, (3) saving up first and when they could buy it.
- This is a demo with made-up customers. Do not ask for personal or account information.`;

// Turn the engine output into a compact text summary for the model
function buildData(customer, overview, sim, afford) {
  const lines = [];
  lines.push(`Customer: ${customer.name}, ${customer.age}. ${customer.household}. ${customer.story}`);
  lines.push(`Monthly income $${overview.monthlyIncome}, monthly bills $${overview.monthlyExpenses}.`);
  lines.push(`Accounts: ${overview.accounts.map((a) => `${a.label} $${a.amount}`).join(', ')}.`);
  lines.push(`Credit score ${overview.creditScore.value} (${overview.creditScore.label}).`);
  lines.push(`Current car: ${overview.vehicle.model}, ${overview.vehicle.status}.`);
  lines.push(`Today's health: ${overview.health.map((h) => `${h.label} ${h.display} (${h.status})`).join('; ')}.`);
  lines.push(`Assumptions: gas $${sim.assumptions.gasPrice}/gal, income gap ${sim.assumptions.incomeGapMonths} months, surprise repair $${sim.assumptions.surpriseRepair}.`);
  if (sim.assumptions.plans?.length) {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    lines.push(`Their yearly plans: ${sim.assumptions.plans.map((p) => `${p.label} ${p.amount >= 0 ? '+' : '-'}$${Math.abs(p.amount)} in ${MONTHS[p.month]}`).join('; ')}.`);
  }
  lines.push(`Projected monthly income in this scenario: $${sim.assumptions.monthlyIncome}.`);
  lines.push('Options:');
  for (const o of sim.options) {
    lines.push(
      `- ${o.label}${o.recommended ? ' (RECOMMENDED)' : ''}: car costs $${o.monthly.totalCar}/mo ` +
      `(payment $${o.monthly.carPayment}, insurance $${o.monthly.insurance}, maintenance $${o.monthly.maintenance}, gas $${o.monthly.gas}); ` +
      `upfront $${o.upfront}; left over $${o.leftoverPerMonth}/mo; 5-year true cost $${o.fiveYear.netCost}; ` +
      (o.loan ? `loan $${o.loan.financed} at ${o.loan.apr}% for ${o.loan.termMonths} months, total interest $${o.loan.totalInterest}; ` : '') +
      `perk: ${o.perk || 'none'}; ` +
      (o.nextService ? `next big service: ${o.nextService.label} ($${o.nextService.amount}) in ${o.nextService.when}; ` : '') +
      `lowest savings point in the forecast $${o.stress.savingsAfter}. Why: ${o.why}`
    );
  }
  lines.push(`Recommendation: ${sim.recommendation.headline}. Next step: ${sim.recommendation.nextStep}`);
  if (afford) {
    lines.push(
      `AFFORDABILITY CHECK for a $${afford.amount} purchase from savings: verdict "${afford.verdict}". ` +
      `Savings go from $${afford.savingsBefore} to $${afford.savingsAfter}; safety cushion from ${afford.runwayBefore} to ${afford.runwayAfter} months of bills. ` +
      (afford.monthsToRecover !== null ? `Back to today's savings in about ${afford.monthsToRecover} months (${afford.recoverBy}). ` : '') +
      (afford.saveFirstMonths ? `To buy it and still keep a 3-month cushion, save for about ${afford.saveFirstMonths} months (${afford.saveFirstBy}).` : 'They can buy it and still keep a 3-month cushion.')
    );
  }
  return lines.join('\n');
}

// Backup answer that uses only our numbers (used if Gemini is unavailable)
function fallbackAnswer(customer, sim) {
  const best = sim.options.find((o) => o.recommended);
  const others = sim.options.filter((o) => !o.recommended);
  const alt = others
    .map((o) => `${o.label} costs $${o.monthly.totalCar}/mo for the car (5-year true cost $${o.fiveYear.netCost.toLocaleString()}).`)
    .join(' ');
  return `My pick for ${customer.shortName || customer.name}: ${best.label}. ${best.why} ` +
    `Other options: ${alt} Next step: ${sim.recommendation.nextStep} Want to explore other options?`;
}

// Backup answer for "can I afford it?" questions (used if Gemini is unavailable)
function fallbackAfford(customer, a) {
  const money = (n) => `$${Number(n).toLocaleString('en-US')}`;
  const opener = a.verdict === 'comfortable' ? 'Yes, you can afford it.'
    : a.verdict === 'tight' ? "You can, but it's tight."
    : 'Not yet, but you can get there.';
  const later = a.saveFirstMonths ? `save for about ${a.saveFirstMonths} months and buy it in ${a.saveFirstBy} with your cushion intact` : 'buy it now and still keep a 3-month cushion';
  return `${opener} Spending ${money(a.amount)} takes your savings from ${money(a.savingsBefore)} to ${money(a.savingsAfter)}, ` +
    `which covers ${a.runwayAfter} months of bills instead of ${a.runwayBefore}. Three ideas: ` +
    `1) Go for the full ${money(a.amount)}${a.recoverBy ? ` and you'd be back to today's savings by ${a.recoverBy}` : ''}. ` +
    `2) Scale it down to about ${money(Math.round(a.amount / 2 / 50) * 50)} to protect your cushion. ` +
    `3) Or ${later}. Want to explore other options?`;
}

// history = [{ role: 'user' | 'cosmo', text: '...' }]
export async function askCosmo({ customer, overview, sim, message, history = [], afford = null }) {
  const key = process.env.GEMINI_API_KEY;
  const backup = afford ? fallbackAfford(customer, afford) : fallbackAnswer(customer, sim);
  if (!key) return { reply: backup, source: 'fallback' };

  const contents = [
    ...history.slice(-8).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(m.text).slice(0, 2000) }],
    })),
    { role: 'user', parts: [{ text: String(message).slice(0, 2000) }] },
  ];

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: `${RULES}\n\nDATA:\n${buildData(customer, overview, sim, afford)}` }] },
          contents,
        }),
        signal: AbortSignal.timeout(20000),
      }
    );
    if (!res.ok) {
      console.error('Gemini error', res.status, (await res.text()).slice(0, 300));
      return { reply: backup, source: 'fallback' };
    }
    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
    return reply ? { reply, source: 'gemini' } : { reply: backup, source: 'fallback' };
  } catch (err) {
    console.error('Gemini request failed:', err.message);
    return { reply: backup, source: 'fallback' };
  }
}
