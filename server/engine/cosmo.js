// ============================================================
// Cosmo - Orbit's assistant
// Cosmo NEVER does its own math. We give it the numbers our
// engine computed, and it explains them in plain language.
// ============================================================

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

const RULES = `You are Cosmo, the friendly money guide inside Orbit, a Toyota + PNC financial dashboard.
Rules:
- Use ONLY the numbers in the DATA section. Never invent numbers or do your own math.
- Answer the question in your FIRST sentence (yes / no / the date / the number), then explain.
- For "what if" questions (moving a trip or goal, holding off on purchases), use WHAT-IF RESULTS and compare them with "As planned today": say what moves and by how much. Never say you can't recalculate.
- If a what-if shows no change, say so plainly and give that goal's current date from "As planned today".
- If no what-if result fits, say what you do know, then point them to the matching tab under "Make it yours" (What-ifs, Plans, Milestones, Your car) to try it on their path.
- For questions about spending habits, use SPENDING TRENDS: name their tight months and what drives them.
- Describe savings cushions with the plain-words version in the data (like "about 3 days of bills"), never "0.1 months".
- Plain language for someone who is not a finance expert. Explain any term you use.
- Keep answers short: 2-4 sentences, or at most 3 short bullets. No jargon.
- When giving advice: give ONE clear recommendation, the main reason, and one or two other options with their trade-offs.
- For car or path questions: one sentence with our pick and why, then one short bullet per other path (car cost per month and how it compares), then the next step. Skip loan details, interest and insurance unless they ask.
- End with a short follow-up question such as "Want to explore other options?"
- Be warm and honest. If every option has a risk, say so kindly.
- For "can I afford" questions, use the AFFORDABILITY CHECK in the data: answer clearly (yes / it's tight / not yet), say what it does to their savings cushion, then give exactly three ideas: (1) the full purchase, (2) a scaled-down version, (3) saving up first and when they could buy it.
- If they ask about service or maintenance, mention they can update their mileage and last oil change in the "Your car" tab for more accurate dates.
- When milestones (home, trips, school) are in the data, mention how each path affects reaching them. That is often the most important trade-off.
- This is a demo with made-up customers. Do not ask for personal or account information.`;

// Savings cushion in words anyone gets: "about 3 days of bills", "about 2.5 months of bills"
function cushionText(months) {
  if (months < 1) return `about ${Math.max(1, Math.round(months * 30))} days of bills`;
  return `about ${months.toFixed(1)} months of bills`;
}

// One line per milestone: "Family road trip on time, reached March 2027"
const milestoneText = (list) =>
  list.map((m) => `${m.label} ${m.reached ? `${m.onTrack ? 'on time' : 'late'}, reached ${m.reached}` : 'not reached within 5 years'}`).join('; ');

// Turn the engine output into a compact text summary for the model
function buildData(customer, overview, sim, afford, whatIfs, trends) {
  const lines = [];
  lines.push(`Customer: ${customer.name}, ${customer.age}. ${customer.household}. ${customer.story}`);
  lines.push(`Monthly income $${overview.monthlyIncome}, monthly bills $${overview.monthlyExpenses}.`);
  lines.push(`Accounts: ${overview.accounts.map((a) => `${a.label} $${a.amount}`).join(', ')}.`);
  lines.push(`Credit score ${overview.creditScore.value} (${overview.creditScore.label}).`);
  lines.push(`Current car: ${overview.vehicle.model}, ${overview.vehicle.status}.`);
  lines.push(`Savings cushion: ${cushionText(customer.savings / overview.monthlyExpenses)}.`);
  lines.push(`Today's health: ${overview.health.map((h) => `${h.label} ${h.display} (${h.status})`).join('; ')}.`);
  lines.push(`Assumptions: gas $${sim.assumptions.gasPrice}/gal, one-time expense $${sim.assumptions.surpriseRepair}.`);
  if (sim.assumptions.plans?.length) {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    lines.push(`Their plans: ${sim.assumptions.plans.map((p) => `${p.label} ${p.amount >= 0 ? '+' : '-'}$${Math.abs(p.amount)} ${p.repeat === false ? 'once in' : 'every'} ${MONTHS[p.month]}`).join('; ')}.`);
  }
  lines.push(`Projected monthly income in this scenario: $${sim.assumptions.monthlyIncome}.`);
  lines.push(`Driving: about ${sim.assumptions.weeklyMiles} miles a week; current car at ${sim.assumptions.currentMileage} miles; last oil change at ${sim.assumptions.lastOilChangeMiles} miles. Service dates are estimated from these miles.`);
  lines.push('Options:');
  for (const o of sim.options) {
    lines.push(
      `- ${o.label}${o.recommended ? ' (RECOMMENDED)' : ''}: car costs $${o.monthly.totalCar}/mo ` +
      `(payment $${o.monthly.carPayment}, insurance $${o.monthly.insurance}, maintenance $${o.monthly.maintenance}, gas $${o.monthly.gas}); ` +
      `upfront $${o.upfront}; left over $${o.leftoverPerMonth}/mo; 5-year true cost $${o.fiveYear.netCost}; ` +
      (o.loan ? `loan $${o.loan.financed} at ${o.loan.apr}% for ${o.loan.termMonths} months, total interest $${o.loan.totalInterest}; ` : '') +
      `perk: ${o.perk || 'none'}; ` +
      (o.nextService ? `next service: ${o.nextService.label}${o.nextService.atMiles ? ` at ${o.nextService.atMiles} miles` : ''} (${o.nextService.amount ? `$${o.nextService.amount}` : 'included'}) around ${o.nextService.when}; ` : '') +
      (o.milestones?.length
        ? `milestones: ${o.milestones.map((m) => `${m.label} ($${m.amount} by ${m.target}) ${m.reached ? (m.onTrack ? `on track, reached ${m.reached}` : `late, reached ${m.reached}`) : 'not reached within 5 years'}`).join('; ')}; `
        : '') +
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
  if (trends) {
    const tight = trends.months.filter((m) => m.leftover < 0).map((m) => m.label);
    lines.push(
      `SPENDING TRENDS for the next 12 months: about $${trends.avgSpending}/mo on average; busiest month ${trends.busiest.label} ($${trends.busiest.spending}); ` +
      (tight.length ? `tight months (spending more than income): ${tight.join(', ')}.` : 'no month spends more than income.')
    );
  }
  if (whatIfs) {
    lines.push(`WHAT-IF RESULTS (already calculated for the recommended path, ${whatIfs.path}):`);
    const base = whatIfs.today;
    const signed = (n) => `${n >= 0 ? '+' : '-'}$${Math.abs(n)}`;
    for (const r of [base, ...whatIfs.changes]) {
      // Differences vs today are calculated here, so the model never has to subtract
      // Only real changes are listed; "no change" gets a plain explanation instead of "+$0"
      const changes = [];
      if (r !== base) {
        if (r.in5Years !== base.in5Years) changes.push(`5-year net worth ${signed(r.in5Years - base.in5Years)}`);
        if (r.lowest !== base.lowest) changes.push(`lowest savings point ${signed(r.lowest - base.lowest)}`);
        for (const m of r.milestones) {
          const before = base.milestones.find((b) => b.label === m.label)?.reachedMonth;
          if (before == null || m.reachedMonth == null || before === m.reachedMonth) continue;
          const diff = m.reachedMonth - before;
          changes.push(`${m.label} ${Math.abs(diff)} months ${diff < 0 ? 'sooner' : 'later'}`);
        }
      }
      const vsToday = r === base ? ''
        : changes.length ? ` Compared with today: ${changes.join(', ')}.`
        : ' No change to any dates or savings.';
      lines.push(
        `- ${r.label}: lowest savings point $${r.lowest} (${r.holdsUp ? 'stays above $0' : 'dips below $0'}); ` +
        `net worth in 5 years $${r.in5Years}; milestones: ${milestoneText(r.milestones) || 'none'}.${vsToday}`
      );
    }
  }
  return lines.join('\n');
}

// Backup answer that uses only our numbers (used if Gemini is unavailable): our pick, then one line per other path
function fallbackAnswer(customer, sim) {
  const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
  const best = sim.options.find((o) => o.recommended);
  const others = sim.options
    .filter((o) => !o.recommended)
    .map((o) => `- ${o.label}: ${money(o.monthly.totalCar)}/mo for the car, ${money(o.fiveYear.netCost - best.fiveYear.netCost)} more over 5 years`);
  return `My pick: **${best.label}**, the lowest true cost over 5 years (${money(best.fiveYear.netCost)}).\n` +
    `${others.join('\n')}\nNext step: ${sim.recommendation.nextStep}`;
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

// Backup answer for "what if" questions (used if Gemini is unavailable): lists what each what-if changes
function fallbackWhatIf(whatIfs) {
  const money = (n) => `${n < 0 ? '-' : '+'}$${Math.abs(n).toLocaleString('en-US')}`;
  const base = whatIfs.today;
  const lines = whatIfs.changes.map((r) => {
    const moved = r.milestones
      .map((m) => {
        const before = base.milestones.find((b) => b.label === m.label)?.reachedMonth;
        return before != null && m.reachedMonth != null && before !== m.reachedMonth ? `${m.label} by ${m.reached}` : null;
      })
      .filter(Boolean);
    const gain = r.in5Years - base.in5Years;
    return gain === 0 && moved.length === 0
      ? `- ${r.label}: no change to your dates or savings.`
      : `- ${r.label}: ${[gain !== 0 ? `${money(gain)} in 5 years` : null, ...moved].filter(Boolean).join(', ')}.`;
  });
  return `Here's what each change does with our pick (${whatIfs.path}):\n${lines.join('\n')}\nWant to try one? Use the Plans or Milestones tab under "Make it yours".`;
}

// Which backup fits the question (only used when Gemini is unavailable)
const isCarQuestion = (message) => /\b(car|path|lease|loan|trade|keep|option|recommend|best|next move)\b/i.test(message);
const isAffordQuestion = (message) => /\b(afford|trip|travel|vacation|go to|buy|spend)\b/i.test(message);

// Backup for everything else: never answers a different question than the one asked
function fallbackGeneral(message) {
  if (isAffordQuestion(message))
    return 'Happy to check that! About how much would it cost? Ask me something like ' +
      '**"Can I afford a $3,000 trip?"** and I\'ll run it against your savings and cushion.';
  return "I'm having trouble thinking that one through right now. Try again in a moment, or ask me about " +
    'your car paths, a what-if like pushing a goal back, or whether you can afford something (with a dollar amount).';
}

const isWhatIf = (message) => /what if|push|delay|postpone|hold off|skip|wait|later|next year/i.test(message);

// history = [{ role: 'user' | 'cosmo', text: '...' }]
export async function askCosmo({ customer, overview, sim, message, history = [], afford = null, whatIfs = null, trends = null }) {
  const key = process.env.GEMINI_API_KEY;
  const backup = afford ? fallbackAfford(customer, afford)
    : whatIfs && isWhatIf(message) ? fallbackWhatIf(whatIfs)
    : isCarQuestion(message) ? fallbackAnswer(customer, sim)
    : fallbackGeneral(message);
  if (!key) return { reply: backup, source: 'fallback' };

  const contents = [
    ...history.slice(-8).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(m.text).slice(0, 2000) }],
    })),
    { role: 'user', parts: [{ text: String(message).slice(0, 2000) }] },
  ];

  // Gemini's free tier sometimes answers "busy" (429/5xx). Wait a moment and retry once.
  const callGemini = () =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: `${RULES}\n\nDATA:\n${buildData(customer, overview, sim, afford, whatIfs, trends)}` }] },
        contents,
      }),
      signal: AbortSignal.timeout(20000),
    });

  try {
    let res = await callGemini();
    if (res.status === 429 || res.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      res = await callGemini();
    }
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
