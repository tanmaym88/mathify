// Pure business rules (no database) — easy to test.

export const STATUS = { ABSENT: 0, PRESENT: 1, LATE_CANCEL: 2 }; // late cancellation (< 3 h notice) is charged

export const isTime = t => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const isDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + 'T00:00:00Z'));
export const isMonth = m => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
export const minutes = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// Hours between two HH:MM times, rounded to the nearest quarter hour (same as the old app).
export function hoursBetween(start, end) {
  if (!isTime(start) || !isTime(end)) return 0;
  const diff = minutes(end) - minutes(start);
  if (diff <= 0) return 0;
  return Math.round((diff / 60) * 4) / 4;
}

// Does [aStart, aEnd) overlap [bStart, bEnd)? A null end means "still running".
export function overlaps(aStart, aEnd, bStart, bEnd) {
  const as = minutes(aStart), ae = aEnd ? minutes(aEnd) : 24 * 60;
  const bs = minutes(bStart), be = bEnd ? minutes(bEnd) : 24 * 60;
  return as < be && bs < ae;
}

export const charged = status => status === STATUS.PRESENT || status === STATUS.LATE_CANCEL;

// Group attendance rows into monthly fee lines.
export function monthlyFees(rows, payments) {
  const months = {};
  for (const r of rows) {
    const m = r.date.slice(0, 7);
    const line = months[m] || (months[m] = { month: m, classes: 0, hours: 0, amount: 0 });
    if (charged(r.is_present) && r.end_time) {
      line.classes += 1;
      line.hours += r.hours;
      line.amount += Math.round(r.hours * r.rate);
    }
  }
  for (const p of payments) {
    const line = months[p.billing_month] || (months[p.billing_month] = { month: p.billing_month, classes: 0, hours: 0, amount: 0 });
    line.paid = { amount: p.amount, method: p.method, paid_on: p.paid_on };
  }
  return Object.values(months)
    .map(l => ({ ...l, hours: Math.round(l.hours * 100) / 100, balance: l.amount - (l.paid ? l.paid.amount : 0) }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function cleanSchedule(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const d of DAYS) {
    const v = input[d];
    if (v && isTime(v.from) && isTime(v.to) && minutes(v.to) > minutes(v.from)) out[d] = { from: v.from, to: v.to };
  }
  return out;
}
export { DAYS };
