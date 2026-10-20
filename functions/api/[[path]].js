// Mathify API — Cloudflare Pages Function handling every /api/* request.
import { sign, verify, getCookie, cookieHeader, SESSION_COOKIE } from '../_lib/session.js';
import {
  STATUS, isTime, isDate, isMonth, minutes, hoursBetween, overlaps, monthlyFees, cleanSchedule
} from '../_lib/rules.js';

/* ---------------- helpers ---------------- */
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const fail = (status, error) => json({ error }, status);
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = msg => { throw new HttpError(400, msg); };

async function body(request) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > 20000) throw new HttpError(413, 'Request too large');
  try { return await request.json(); } catch { bad('Invalid JSON body'); }
}

const str = (v, max = 200) => (v == null ? null : String(v).trim().slice(0, max) || null);
const num = (v, { min = 0, max = 1e7, int = false } = {}) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!isFinite(n) || n < min || n > max) return NaN;
  return int ? Math.round(n) : n;
};
const emailOk = e => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const adminEmails = env => (env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const isLocal = url => ['localhost', '127.0.0.1'].includes(url.hostname);

/* ---------------- auth ---------------- */
async function lookupUser(env, email) {
  email = String(email || '').toLowerCase();
  if (!email) return null;
  if (adminEmails(env).includes(email)) return { role: 'admin', email, sids: [] };
  const { results } = await env.DB.prepare(
    'SELECT id FROM students WHERE is_active = 1 AND (email = ?1 OR parent_email = ?1) ORDER BY id'
  ).bind(email).all();
  if (!results.length) return null;
  return { role: 'student', email, sids: results.map(r => r.id) };
}

// Re-checked on every request, so deactivating a student or removing an admin takes effect immediately.
async function currentUser(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const s = await verify(token, env.SESSION_SECRET);
  if (!s) return null;
  const u = await lookupUser(env, s.email);
  return u ? { ...u, name: s.name, picture: s.picture } : null;
}

function requireUser(user) { if (!user) throw new HttpError(401, 'Please sign in'); return user; }
function requireAdmin(user) { requireUser(user); if (user.role !== 'admin') throw new HttpError(403, 'Admin access required'); return user; }
function requireAccess(user, sid) {
  requireUser(user);
  if (user.role === 'admin' || user.sids.includes(sid)) return user;
  throw new HttpError(403, 'Access denied');
}

async function startSession(env, url, email, name, picture, next = '/app/') {
  const u = await lookupUser(env, email);
  if (!u) return Response.redirect(url.origin + '/app/?error=not_registered&email=' + encodeURIComponent(email), 302);
  const token = await sign({ email: u.email, name: name || '', picture: picture || '' }, env.SESSION_SECRET);
  return new Response(null, {
    status: 302,
    headers: { Location: url.origin + (next.startsWith('/app') ? next : '/app/'), 'Set-Cookie': cookieHeader(SESSION_COOKIE, token, { secure: !isLocal(url) }) }
  });
}

async function googleLogin(url, env) {
  if (!env.GOOGLE_CLIENT_ID) return fail(500, 'Google sign-in is not configured');
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: url.origin + '/api/auth/callback',
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account'
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: 'https://accounts.google.com/o/oauth2/v2/auth?' + params,
      'Set-Cookie': cookieHeader('mathify_oauth_state', state, { maxAge: 600, secure: !isLocal(url) })
    }
  });
}

async function googleCallback(request, url, env) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || state !== getCookie(request, 'mathify_oauth_state')) {
    return Response.redirect(url.origin + '/app/?error=login_failed', 302);
  }
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: url.origin + '/api/auth/callback', grant_type: 'authorization_code'
    })
  });
  if (!tokenRes.ok) return Response.redirect(url.origin + '/app/?error=login_failed', 302);
  const { access_token } = await tokenRes.json();
  const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + access_token } });
  if (!infoRes.ok) return Response.redirect(url.origin + '/app/?error=login_failed', 302);
  const info = await infoRes.json();
  if (!info.email || info.email_verified === false) return Response.redirect(url.origin + '/app/?error=login_failed', 302);
  const resp = await startSession(env, url, info.email, info.name, info.picture);
  resp.headers.append('Set-Cookie', cookieHeader('mathify_oauth_state', '', { maxAge: 0, secure: !isLocal(url) }));
  return resp;
}

/* ---------------- students ---------------- */
const STUDENT_FIELDS = {
  name: v => str(v, 120), email: v => str(v, 160)?.toLowerCase() ?? null, parent_email: v => str(v, 160)?.toLowerCase() ?? null,
  phone: v => str(v, 40), parent_name: v => str(v, 120), dob: v => str(v, 20), gender: v => str(v, 20),
  grade: v => str(v, 40), exams: v => str(v, 200), mode: v => str(v, 40),
  hours_per_week: v => num(v, { max: 40 }), maths_level: v => num(v, { min: 1, max: 10, int: true }),
  objective: v => str(v, 120), city: v => str(v, 80), country: v => str(v, 80),
  fee_per_hour: v => num(v, { max: 100000, int: true }), notes: v => str(v, 2000),
  is_active: v => (v === undefined ? undefined : (v ? 1 : 0))
};

function pickStudent(input, { partial }) {
  const out = {};
  for (const [k, fn] of Object.entries(STUDENT_FIELDS)) {
    if (!(k in input)) continue;
    const v = fn(input[k]);
    if (Number.isNaN(v)) bad(`Invalid value for ${k}`);
    if (v !== undefined) out[k] = v;
  }
  if ('schedule' in input) out.schedule = JSON.stringify(cleanSchedule(input.schedule));
  if (!partial || 'name' in out) if (!out.name) bad("Student's name is required");
  if (!partial || 'email' in out) if (!emailOk(out.email)) bad("A valid student Google email is required (used to sign in)");
  if (out.parent_email && !emailOk(out.parent_email)) bad('Parent email is not valid');
  if (!partial && out.fee_per_hour == null) out.fee_per_hour = 0;
  return out;
}

const parseStudent = r => r && ({ ...r, schedule: JSON.parse(r.schedule || '{}'), is_active: !!r.is_active });

async function getStudent(env, sid) {
  const r = await env.DB.prepare('SELECT * FROM students WHERE id = ?').bind(sid).first();
  if (!r) throw new HttpError(404, 'Student not found');
  return parseStudent(r);
}

async function insertStudent(env, s) {
  const keys = Object.keys(s);
  try {
    const r = await env.DB.prepare(
      `INSERT INTO students (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')}) RETURNING id`
    ).bind(...keys.map(k => s[k])).first();
    return r.id;
  } catch (e) {
    if (/UNIQUE/i.test(String(e))) throw new HttpError(409, 'A student with this email already exists');
    throw e;
  }
}

/* ---------------- attendance ---------------- */
async function checkSlot(env, sid, date, start, end, ignoreId = 0) {
  if (!isDate(date)) bad('Invalid date');
  if (!isTime(start)) bad('Invalid start time');
  if (end != null && !isTime(end)) bad('Invalid end time');
  if (end && minutes(end) <= minutes(start)) bad('End time must be after start time');
  if (!end) {
    const open = await env.DB.prepare('SELECT id, date, start_time FROM attendance WHERE student_id = ? AND end_time IS NULL AND id != ?')
      .bind(sid, ignoreId).first();
    if (open) throw new HttpError(409, `A class is already in progress (started ${open.date} ${open.start_time}). End it first.`);
  }
  const { results } = await env.DB.prepare('SELECT id, start_time, end_time FROM attendance WHERE student_id = ? AND date = ? AND id != ?')
    .bind(sid, date, ignoreId).all();
  const clash = results.find(r => overlaps(start, end, r.start_time, r.end_time));
  if (clash) throw new HttpError(409, `Overlaps another class on ${date} (${clash.start_time}–${clash.end_time || 'in progress'})`);
}

const parseStatus = v => {
  if (v === undefined || v === null || v === '') return STATUS.PRESENT;
  const n = Number(v);
  if (![STATUS.ABSENT, STATUS.PRESENT, STATUS.LATE_CANCEL].includes(n)) bad('Invalid attendance status');
  return n;
};

/* ---------------- invoice data ---------------- */
async function invoiceData(env, sid, month) {
  if (!isMonth(month)) bad('Invalid month');
  const s = await getStudent(env, sid);
  const { results } = await env.DB.prepare(
    "SELECT date, start_time, end_time, hours, rate, is_present FROM attendance WHERE student_id = ? AND substr(date,1,7) = ? AND end_time IS NOT NULL AND is_present IN (1,2) ORDER BY date, start_time"
  ).bind(sid, month).all();
  const lines = results.map(r => ({ ...r, amount: Math.round(r.hours * r.rate) }));
  const pay = await env.DB.prepare('SELECT amount, method, paid_on FROM payments WHERE student_id = ? AND billing_month = ?').bind(sid, month).first();
  const total = lines.reduce((a, l) => a + l.amount, 0);
  return {
    invoice_number: `MTH-${month.replace('-', '')}-${String(sid).padStart(4, '0')}`,
    issued_on: new Date().toISOString().slice(0, 10),
    month,
    business: { name: 'Mathify', owner: 'Tanmay Mogra', city: 'Pune, India', whatsapp: env.BUSINESS_WHATSAPP || '', email: env.BUSINESS_EMAIL || '' },
    student: { id: s.id, name: s.name, parent_name: s.parent_name, email: s.email, parent_email: s.parent_email, phone: s.phone },
    lines,
    total_hours: Math.round(lines.reduce((a, l) => a + l.hours, 0) * 100) / 100,
    total,
    paid: pay || null,
    balance: total - (pay ? pay.amount : 0)
  };
}

/* ---------------- enquiries ---------------- */
const ENQ_FIELDS = ['student', 'gender', 'dob', 'grade', 'exams', 'semail', 'parent', 'phone', 'pemail', 'city', 'country',
  'objective', 'mode', 'hours', 'days', 'time', 'level', 'demo', 'source', 'message'];

/* ---------------- router ---------------- */
const routes = [];
const route = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, handler });
};

// --- auth
route('GET', '/api/auth/login', ({ url, env }) => googleLogin(url, env));
route('GET', '/api/auth/callback', ({ request, url, env }) => googleCallback(request, url, env));
route('POST', '/api/auth/logout', ({ url }) => json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(SESSION_COOKIE, '', { maxAge: 0, secure: !isLocal(url) }) }));
// Local testing only: never active on the live site (needs DEV_LOGIN=1 *and* localhost).
route('GET', '/api/auth/dev', ({ url, env }) => {
  if (env.DEV_LOGIN !== '1' || !isLocal(url)) return fail(404, 'Not found');
  return startSession(env, url, url.searchParams.get('email'), 'Dev user', '');
});

route('GET', '/api/me', async ({ user, env }) => {
  requireUser(user);
  let students = [];
  if (user.role === 'student') {
    const { results } = await env.DB.prepare(
      `SELECT id, name FROM students WHERE id IN (${user.sids.map(() => '?').join(',')})`
    ).bind(...user.sids).all();
    students = results;
  }
  return json({ email: user.email, name: user.name, picture: user.picture, role: user.role, students });
});

// --- admin dashboard
route('GET', '/api/dashboard', async ({ user, env, url }) => {
  requireAdmin(user);
  const today = isDate(url.searchParams.get('today')) ? url.searchParams.get('today') : new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  const [open, students, att, pays, enq] = await Promise.all([
    env.DB.prepare('SELECT a.id, a.student_id, a.date, a.start_time, s.name FROM attendance a JOIN students s ON s.id = a.student_id WHERE a.end_time IS NULL ORDER BY a.date, a.start_time').all(),
    env.DB.prepare('SELECT id, name, schedule, fee_per_hour, phone FROM students WHERE is_active = 1 ORDER BY name').all(),
    env.DB.prepare("SELECT student_id, date, start_time, end_time, hours, rate, is_present FROM attendance WHERE end_time IS NOT NULL").all(),
    env.DB.prepare('SELECT student_id, billing_month, amount, method, paid_on FROM payments').all(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE status = 'new'").first()
  ]);
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(today + 'T00:00:00Z').getUTCDay()];
  const doneToday = new Set(att.results.filter(a => a.date === today).map(a => a.student_id));
  const openIds = new Set(open.results.map(o => o.student_id));
  const todayClasses = students.results
    .map(s => ({ ...s, slot: JSON.parse(s.schedule || '{}')[dayName] }))
    .filter(s => s.slot)
    .map(s => ({ id: s.id, name: s.name, from: s.slot.from, to: s.slot.to, done: doneToday.has(s.id), in_progress: openIds.has(s.id) }))
    .sort((a, b) => a.from.localeCompare(b.from));
  const thisMonth = today.slice(0, 7);
  const dues = [];
  for (const s of students.results) {
    const fees = monthlyFees(att.results.filter(a => a.student_id === s.id), pays.results.filter(p => p.student_id === s.id));
    for (const f of fees) if (f.month < thisMonth && f.balance > 0) dues.push({ student_id: s.id, name: s.name, phone: s.phone, month: f.month, balance: f.balance });
  }
  return json({ today, day: dayName, in_progress: open.results, today_classes: todayClasses, dues, new_enquiries: enq.n });
});

// --- students
route('GET', '/api/students', async ({ user, env }) => {
  requireAdmin(user);
  const { results } = await env.DB.prepare(`
    SELECT s.id, s.name, s.email, s.parent_email, s.phone, s.grade, s.mode, s.fee_per_hour, s.is_active, s.schedule,
      (SELECT MAX(date) FROM attendance a WHERE a.student_id = s.id) AS last_class,
      (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id AND a.end_time IS NULL) AS in_progress
    FROM students s ORDER BY s.is_active DESC, s.name COLLATE NOCASE`).all();
  return json({ students: results.map(parseStudent) });
});

route('POST', '/api/students', async ({ user, env, request }) => {
  requireAdmin(user);
  const s = pickStudent(await body(request), { partial: false });
  const id = await insertStudent(env, s);
  return json({ student: await getStudent(env, id) }, 201);
});

route('GET', '/api/students/:id', async ({ user, env, params }) => {
  const sid = Number(params.id); requireAccess(user, sid);
  const s = await getStudent(env, sid);
  if (user.role !== 'admin') delete s.notes; // private teacher notes
  return json({ student: s });
});

route('PUT', '/api/students/:id', async ({ user, env, params, request }) => {
  requireAdmin(user);
  const sid = Number(params.id); await getStudent(env, sid);
  const s = pickStudent(await body(request), { partial: true });
  const keys = Object.keys(s);
  if (!keys.length) bad('Nothing to update');
  try {
    await env.DB.prepare(`UPDATE students SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = ?`).bind(...keys.map(k => s[k]), sid).run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e))) throw new HttpError(409, 'A student with this email already exists');
    throw e;
  }
  return json({ student: await getStudent(env, sid) });
});

route('DELETE', '/api/students/:id', async ({ user, env, params }) => {
  requireAdmin(user);
  const sid = Number(params.id); await getStudent(env, sid);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM attendance WHERE student_id = ?').bind(sid),
    env.DB.prepare('DELETE FROM payments WHERE student_id = ?').bind(sid),
    env.DB.prepare('UPDATE enquiries SET student_id = NULL WHERE student_id = ?').bind(sid),
    env.DB.prepare('DELETE FROM students WHERE id = ?').bind(sid)
  ]);
  return json({ ok: true });
});

// --- attendance
route('GET', '/api/students/:id/attendance', async ({ user, env, params, url }) => {
  const sid = Number(params.id); requireAccess(user, sid);
  const month = url.searchParams.get('month');
  const q = isMonth(month)
    ? env.DB.prepare('SELECT * FROM attendance WHERE student_id = ? AND substr(date,1,7) = ? ORDER BY date DESC, start_time DESC').bind(sid, month)
    : env.DB.prepare('SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC, start_time DESC LIMIT 500').bind(sid);
  const { results } = await q.all();
  if (user.role !== 'admin') results.forEach(r => delete r.note);
  return json({ attendance: results });
});

route('POST', '/api/students/:id/attendance', async ({ user, env, params, request }) => {
  requireAdmin(user);
  const sid = Number(params.id);
  const s = await getStudent(env, sid);
  const b = await body(request);
  const end = b.end_time || null;
  const status = parseStatus(b.is_present);
  await checkSlot(env, sid, b.date, b.start_time, end);
  const row = await env.DB.prepare(
    'INSERT INTO attendance (student_id, date, start_time, end_time, hours, is_present, rate, note) VALUES (?,?,?,?,?,?,?,?) RETURNING *'
  ).bind(sid, b.date, b.start_time, end, end ? hoursBetween(b.start_time, end) : 0, status, s.fee_per_hour, str(b.note, 500)).first();
  return json({ attendance: row }, 201);
});

async function getAttendance(env, id) {
  const r = await env.DB.prepare('SELECT * FROM attendance WHERE id = ?').bind(id).first();
  if (!r) throw new HttpError(404, 'Attendance record not found');
  return r;
}

route('PUT', '/api/attendance/:id', async ({ user, env, params, request }) => {
  requireAdmin(user);
  const id = Number(params.id);
  const cur = await getAttendance(env, id);
  const b = await body(request);
  const date = b.date ?? cur.date;
  const start = b.start_time ?? cur.start_time;
  const end = 'end_time' in b ? (b.end_time || null) : cur.end_time;
  const status = 'is_present' in b ? parseStatus(b.is_present) : cur.is_present;
  const rate = 'rate' in b ? num(b.rate, { max: 100000, int: true }) : cur.rate;
  if (rate == null || Number.isNaN(rate)) bad('Invalid rate');
  await checkSlot(env, cur.student_id, date, start, end, id);
  const row = await env.DB.prepare(
    "UPDATE attendance SET date=?, start_time=?, end_time=?, hours=?, is_present=?, rate=?, note=?, updated_at=datetime('now') WHERE id=? RETURNING *"
  ).bind(date, start, end, end ? hoursBetween(start, end) : 0, status, rate, 'note' in b ? str(b.note, 500) : cur.note, id).first();
  return json({ attendance: row });
});

route('POST', '/api/attendance/:id/end', async ({ user, env, params, request }) => {
  requireAdmin(user);
  const id = Number(params.id);
  const cur = await getAttendance(env, id);
  if (cur.end_time) bad('This class has already ended');
  const { end_time } = await body(request);
  if (!isTime(end_time)) bad('Invalid end time');
  if (minutes(end_time) <= minutes(cur.start_time)) bad('End time must be after start time (' + cur.start_time + ')');
  await checkSlot(env, cur.student_id, cur.date, cur.start_time, end_time, id);
  const row = await env.DB.prepare("UPDATE attendance SET end_time=?, hours=?, updated_at=datetime('now') WHERE id=? RETURNING *")
    .bind(end_time, hoursBetween(cur.start_time, end_time), id).first();
  return json({ attendance: row });
});

route('DELETE', '/api/attendance/:id', async ({ user, env, params }) => {
  requireAdmin(user);
  const id = Number(params.id); await getAttendance(env, id);
  await env.DB.prepare('DELETE FROM attendance WHERE id = ?').bind(id).run();
  return json({ ok: true });
});

// --- fees & payments
route('GET', '/api/students/:id/fees', async ({ user, env, params }) => {
  const sid = Number(params.id); requireAccess(user, sid);
  const s = await getStudent(env, sid);
  const [att, pays] = await Promise.all([
    env.DB.prepare('SELECT date, end_time, hours, rate, is_present FROM attendance WHERE student_id = ? AND end_time IS NOT NULL').bind(sid).all(),
    env.DB.prepare('SELECT billing_month, amount, method, paid_on FROM payments WHERE student_id = ?').bind(sid).all()
  ]);
  return json({ fee_per_hour: s.fee_per_hour, months: monthlyFees(att.results, pays.results) });
});

route('PUT', '/api/students/:id/payments/:month', async ({ user, env, params, request }) => {
  requireAdmin(user);
  const sid = Number(params.id); await getStudent(env, sid);
  const month = params.month; if (!isMonth(month)) bad('Invalid month');
  const b = await body(request);
  const amount = num(b.amount, { max: 10000000, int: true });
  if (amount == null || Number.isNaN(amount)) bad('Invalid amount');
  const method = ['Cash', 'UPI', 'Bank transfer'].includes(b.method) ? b.method : bad('Payment method must be Cash, UPI or Bank transfer');
  if (!isDate(b.paid_on)) bad('Invalid payment date');
  await env.DB.prepare(
    `INSERT INTO payments (student_id, billing_month, amount, method, paid_on) VALUES (?,?,?,?,?)
     ON CONFLICT(student_id, billing_month) DO UPDATE SET amount=excluded.amount, method=excluded.method, paid_on=excluded.paid_on`
  ).bind(sid, month, amount, method, b.paid_on).run();
  return json({ ok: true });
});

route('DELETE', '/api/students/:id/payments/:month', async ({ user, env, params }) => {
  requireAdmin(user);
  await env.DB.prepare('DELETE FROM payments WHERE student_id = ? AND billing_month = ?').bind(Number(params.id), params.month).run();
  return json({ ok: true });
});

route('GET', '/api/students/:id/invoice/:month', async ({ user, env, params }) => {
  const sid = Number(params.id); requireAccess(user, sid);
  return json(await invoiceData(env, sid, params.month));
});

// --- enquiries (website form → database)
route('POST', '/api/enquiries', async ({ env, request }) => {
  const b = await body(request);
  if (b.website) return json({ ok: true }); // honeypot: bots fill hidden fields
  const data = {};
  for (const k of ENQ_FIELDS) { const v = str(b[k], k === 'message' ? 2000 : 200); if (v) data[k] = v; }
  if (!data.student || !data.parent || !data.phone) bad("Student's name, parent's name and WhatsApp number are required");
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE created_at > datetime('now','-1 hour')").first();
  if (recent.n >= 30) throw new HttpError(429, 'Too many enquiries right now — please WhatsApp instead.');
  await env.DB.prepare('INSERT INTO enquiries (data) VALUES (?)').bind(JSON.stringify(data)).run();
  return json({ ok: true }, 201);
});

route('GET', '/api/enquiries', async ({ user, env }) => {
  requireAdmin(user);
  const { results } = await env.DB.prepare('SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 500').all();
  return json({ enquiries: results.map(r => ({ ...r, data: JSON.parse(r.data) })) });
});

route('PUT', '/api/enquiries/:id', async ({ user, env, params, request }) => {
  requireAdmin(user);
  const { status } = await body(request);
  if (!['new', 'contacted', 'converted', 'closed'].includes(status)) bad('Invalid status');
  const r = await env.DB.prepare('UPDATE enquiries SET status = ? WHERE id = ?').bind(status, Number(params.id)).run();
  if (!r.meta.changes) throw new HttpError(404, 'Enquiry not found');
  return json({ ok: true });
});

route('POST', '/api/enquiries/:id/convert', async ({ user, env, params, request }) => {
  requireAdmin(user);
  const eid = Number(params.id);
  const enq = await env.DB.prepare('SELECT * FROM enquiries WHERE id = ?').bind(eid).first();
  if (!enq) throw new HttpError(404, 'Enquiry not found');
  if (enq.student_id) throw new HttpError(409, 'This enquiry is already a student');
  const d = JSON.parse(enq.data);
  const fromEnquiry = {
    name: d.student, email: d.semail, parent_email: d.pemail, phone: d.phone, parent_name: d.parent, dob: d.dob,
    gender: d.gender, grade: d.grade, exams: d.exams, mode: d.mode,
    hours_per_week: parseFloat(d.hours) > 0 && parseFloat(d.hours) <= 40 ? parseFloat(d.hours) : null,
    maths_level: parseInt(d.level) >= 1 && parseInt(d.level) <= 10 ? parseInt(d.level) : null,
    objective: d.objective, city: d.city, country: d.country
  };
  for (const k of Object.keys(fromEnquiry)) if (fromEnquiry[k] == null || fromEnquiry[k] === '') delete fromEnquiry[k];
  if (fromEnquiry.mode) fromEnquiry.mode = /offline/i.test(fromEnquiry.mode) ? 'Offline' : /online/i.test(fromEnquiry.mode) ? 'Online' : fromEnquiry.mode;
  const s = pickStudent({ ...fromEnquiry, ...(await body(request)) }, { partial: false });
  const sid = await insertStudent(env, s);
  await env.DB.prepare("UPDATE enquiries SET status = 'converted', student_id = ? WHERE id = ?").bind(sid, eid).run();
  return json({ student: await getStudent(env, sid) }, 201);
});

/* ---------------- entry point ---------------- */
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (!env.DB) return fail(503, 'The Mathify app database is not connected yet. See README → Database (D1).');
  try {
    // Block cross-site writes (CSRF): mutating requests must come from this site.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return fail(403, 'Cross-site request blocked');
    }
    for (const r of routes) {
      if (r.method !== request.method) continue;
      const m = url.pathname.match(r.re);
      if (!m) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const needsUser = !url.pathname.startsWith('/api/auth/') && !(r.method === 'POST' && url.pathname === '/api/enquiries');
      const user = needsUser ? await currentUser(request, env) : null;
      return await r.handler({ request, env, url, params, user });
    }
    return fail(404, 'Not found');
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error(e);
    return fail(500, 'Something went wrong');
  }
}
