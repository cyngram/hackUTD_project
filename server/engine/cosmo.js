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
- This is a demo with made-up customers. Do not ask for personal or account information.`;

// Turn the engine output into a compact text summary for the model
function buildData(customer, overview, sim) {
  const lines = [];
  lines.push(`Customer: ${customer.name}, ${customer.age}. ${customer.household}. ${customer.story}`);
  lines.push(`Monthly income $${overview.monthlyIncome}, monthly bills $${overview.monthlyExpenses}.`);
  lines.push(`Accounts: ${overview.accounts.map((a) => `${a.label} $${a.amount}`).join(', ')}.`);
  lines.push(`Credit score ${overview.creditScore.value} (${overview.creditScore.label}).`);
  lines.push(`Current car: ${overview.vehicle.model}, ${overview.vehicle.status}.`);
  lines.push(`Today's health: ${overview.health.map((h) => `${h.label} ${h.display} (${h.status})`).join('; ')}.`);
  lines.push(`Assumptions: gas $${sim.assumptions.gasPrice}/gal, income gap ${sim.assumptions.incomeGapMonths} months, surprise repair $${sim.assumptions.surpriseRepair}.`);
  lines.push('Options:');
  for (const o of sim.options) {
    lines.push(
      `- ${o.label}${o.recommended ? ' (RECOMMENDED)' : ''}: car costs $${o.monthly.totalCar}/mo ` +
      `(payment $${o.monthly.carPayment}, insurance $${o.monthly.insurance}, maintenance $${o.monthly.maintenance}, gas $${o.monthly.gas}); ` +
      `upfront $${o.upfront}; left over $${o.leftoverPerMonth}/mo; 5-year true cost $${o.fiveYear.netCost}; ` +
      (o.loan ? `loan $${o.loan.financed} at ${o.loan.apr}% for ${o.loan.termMonths} months, total interest $${o.loan.totalInterest}; ` : '') +
      `perk: ${o.perk || 'none'}; savings after stress test $${o.stress.savingsAfter}. Why: ${o.why}`
    );
  }
  lines.push(`Recommendation: ${sim.recommendation.headline}. Next step: ${sim.recommendation.nextStep}`);
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

// history = [{ role: 'user' | 'cosmo', text: '...' }]
export async function askCosmo({ customer, overview, sim, message, history = [] }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { reply: fallbackAnswer(customer, sim), source: 'fallback' };

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
          system_instruction: { parts: [{ text: `${RULES}\n\nDATA:\n${buildData(customer, overview, sim)}` }] },
          contents,
        }),
        signal: AbortSignal.timeout(20000),
      }
    );
    if (!res.ok) {
      console.error('Gemini error', res.status, (await res.text()).slice(0, 300));
      return { reply: fallbackAnswer(customer, sim), source: 'fallback' };
    }
    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
    return reply ? { reply, source: 'gemini' } : { reply: fallbackAnswer(customer, sim), source: 'fallback' };
  } catch (err) {
    console.error('Gemini request failed:', err.message);
    return { reply: fallbackAnswer(customer, sim), source: 'fallback' };
  }
}
