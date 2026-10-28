/* Mathify app — admin & student dashboards. Plain JavaScript, no framework, no build step. */
(function () {
  'use strict';

  /* ============ small helpers ============ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const view = $('#view');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  const rs = n => 'Rs. ' + Math.round(Number(n) || 0).toLocaleString('en-IN'); // PDF fonts lack the ₹ glyph
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const STATUS = { 0: ['Absent', 'grey'], 1: ['Present', 'green'], 2: ['Late cancel (charged)', 'amber'] };
  const monthName = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const niceDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const digits = p => String(p || '').replace(/\D/g, '');
  const waNumber = p => { const d = digits(p); return d.length === 10 ? '91' + d : d; };

  // Current date & time in India, whatever the device timezone.
  function nowIST() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date()).map(p => [p.type, p.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}` };
  }

  function toast(msg, isError) {
    const t = $('#toast');
    t.textContent = msg; t.className = isError ? 'error' : ''; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), isError ? 5000 : 2500);
  }

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch('/api' + path, {
      method, credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch { /* empty */ }
    if (res.status === 401) { state.me = null; renderLogin(); throw new Error('Please sign in'); }
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  // Run an action with a busy button and error toast.
  async function act(btn, fn) {
    if (btn) btn.disabled = true;
    try { return await fn(); }
    catch (e) { toast(e.message, true); }
    finally { if (btn) btn.disabled = false; }
  }

  /* ============ modal ============ */
  const modal = $('#modal'), modalForm = $('#modal-form');
  function openModal(html, onSubmit) {
    modalForm.innerHTML = html + '<p class="form-error" id="modal-error"></p>';
    modal.showModal();
    const first = modalForm.querySelector('input:not([type=hidden]),select,textarea');
    if (first) first.focus();
    modalForm.onsubmit = async e => {
      e.preventDefault();
      if (e.submitter && e.submitter.value === 'cancel') { modal.close(); return; }
      const btn = e.submitter;
      if (btn) btn.disabled = true;
      try { await onSubmit(new FormData(modalForm)); modal.close(); }
      catch (err) { $('#modal-error').textContent = err.message; }
      finally { if (btn) btn.disabled = false; }
    };
  }
  const modalButtons = (ok, danger) =>
    `<div class="modal-actions"><button class="btn secondary" value="cancel" formnovalidate>Cancel</button><button class="btn ${danger ? 'danger' : ''}" value="ok">${esc(ok)}</button></div>`;
  function confirmModal(title, text, ok, fn) {
    openModal(`<h2>${esc(title)}</h2><p>${text}</p>${modalButtons(ok, true)}`, fn);
  }

  /* ============ state & routing ============ */
  const state = { me: null, students: null, viewing: null };
  // Logo for PDF invoices (loaded once; invoices still work without it).
  fetch('/assets/logo-invoice-wide.png').then(r => r.ok ? r.blob() : null).then(b => b && new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); })).then(d => { if (d) state.logo = d; }).catch(() => {});

  function setTabs() {
    const top = $('.topbar'); top.hidden = false;
    $('#me-name').textContent = state.me.name && state.me.name !== 'Dev user' ? state.me.name : state.me.email;
    const route = location.hash || '#/';
    const links = state.me.role === 'admin'
      ? [['#/', 'Today'], ['#/students', 'Students'], ['#/enquiries', 'Enquiries']]
      : [['#/', 'My classes & fees']];
    $('#tabs').innerHTML = links.map(([h, t]) => {
      const active = h === '#/' ? route === '#/' || route === '' : route.startsWith(h);
      const badge = t === 'Enquiries' && state.newEnquiries ? `<span class="count">${state.newEnquiries}</span>` : '';
      return `<a href="${h}" class="${active ? 'active' : ''}">${t}${badge}</a>`;
    }).join('');
  }

  // Copy each column header into its cells so tables can stack into cards on phones.
  function labelTables() {
    $$('table').forEach(t => {
      const heads = $$('thead th', t).map(th => th.textContent.trim());
      $$('tbody tr', t).forEach(tr => [...tr.children].forEach((td, i) => { if (heads[i]) td.setAttribute('data-label', heads[i]); }));
    });
  }
  new MutationObserver(labelTables).observe(view, { childList: true, subtree: true });

  async function router() {
    if (!state.me) return;
    setTabs();
    const h = (location.hash || '#/').slice(1);
    const parts = h.split('/').filter(Boolean);
    view.innerHTML = '<p class="loading">Loading…</p>';
    try {
      if (state.me.role !== 'admin') return await studentHome(parts[0] === 'student' ? Number(parts[1]) : null);
      if (!parts.length) return await adminToday();
      if (parts[0] === 'students' && parts.length === 1) return await studentsList();
      if (parts[0] === 'students' && parts[1] === 'new') return await studentForm(null, null, Number(parts[2]) || null);
      if (parts[0] === 'students' && parts[2] === 'edit') return await studentForm(Number(parts[1]));
      if (parts[0] === 'students') return await studentDetail(Number(parts[1]), parts[2] || 'attendance');
      if (parts[0] === 'enquiries') return await enquiries(parts[1] || 'new');
      if (parts[0] === 'preview') return await studentHome(null, Number(parts[1]));
      view.innerHTML = '<p>Page not found. <a href="#/">Go home</a></p>';
    } catch (e) {
      if (state.me) view.innerHTML = `<div class="card"><p class="form-error">${esc(e.message)}</p><a href="#/">Back</a></div>`;
    }
  }
  window.addEventListener('hashchange', router);

  /* ============ login ============ */
  function renderLogin() {
    $('.topbar').hidden = true;
    const params = new URLSearchParams(location.search);
    const err = params.get('error');
    const msg = err === 'not_registered'
      ? `<p class="form-error">${esc(params.get('email') || 'This account')} isn't registered with Mathify yet. Please sign in with the Google account Tanmay has on file, or WhatsApp him to add it.</p>`
      : err ? '<p class="form-error">Sign-in didn\'t complete. Please try again.</p>' : '';
    view.innerHTML = `
      <div class="card login">
        <a href="/"><img class="login-logo" src="/brand/mathify-logo-stacked.svg" alt="Mathify" width="200" height="148"></a>
        <p class="sub">Classes, attendance, fees and invoices</p>
        ${msg}
        <a class="btn" href="/api/auth/login">Sign in with Google</a>
        <p class="note">Students and parents: use the Google account registered with Mathify.<br>
        <a href="/">← Back to the website</a></p>
      </div>`;
  }

  $('#logout').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    state.me = null;
    history.replaceState(null, '', '/app/');
    renderLogin();
  });

  /* ============ admin: today ============ */
  async function adminToday() {
    const now = nowIST();
    const d = await api('/dashboard?today=' + now.date);
    state.newEnquiries = d.new_enquiries; setTabs();
    const dueTotal = d.dues.reduce((a, x) => a + x.balance, 0);
    view.innerHTML = `
      <h1>Today</h1>
      <p class="sub">${esc(niceDate(d.today))}</p>
      <div class="stats">
        <div class="stat"><b>${d.today_classes.length}</b><span>classes scheduled today</span></div>
        <div class="stat"><b>${d.in_progress.length}</b><span>in progress</span></div>
        <div class="stat"><b>${inr(dueTotal)}</b><span>fees due (past months)</span></div>
        <div class="stat"><b>${d.new_enquiries}</b><span>new enquiries</span></div>
      </div>
      ${d.in_progress.length ? `<div class="card"><h2>In progress</h2>${d.in_progress.map(o => `
        <div class="list-item">
          <div><strong><a href="#/students/${o.student_id}">${esc(o.name)}</a></strong><br><span class="hint">Started ${esc(o.start_time)}${o.date !== d.today ? ' on ' + esc(niceDate(o.date)) : ''}</span></div>
          <div class="row"><button class="btn small secondary" data-restart="${o.id}" data-start="${esc(o.start_time)}">Change start</button>
          <button class="btn green" data-end="${o.id}" data-start="${esc(o.start_time)}">End class</button></div>
        </div>`).join('')}</div>` : ''}
      <div class="card"><h2>Today's schedule</h2>
        ${d.today_classes.length ? d.today_classes.map(c => `
          <div class="list-item">
            <div><strong><a href="#/students/${c.id}">${esc(c.name)}</a></strong><br><span class="hint">${esc(c.from)}–${esc(c.to)}</span></div>
            <div class="row">${c.in_progress ? '<span class="badge amber">In progress</span>'
              : c.done ? '<span class="badge green">Done</span>'
              : `<button class="btn small" data-start-class="${c.id}">Start class</button>
                 <button class="btn small secondary" data-mark="${c.id}" data-from="${esc(c.from)}" data-to="${esc(c.to)}">Absent / late cancel</button>`}</div>
          </div>`).join('') : `<p class="empty">No classes scheduled for ${esc(d.day)}. Set weekly schedules on each student's page.</p>`}
      </div>
      <div class="card"><h2>Fees due</h2>
        ${d.dues.length ? d.dues.map(x => `
          <div class="list-item">
            <div><strong><a href="#/students/${x.student_id}/fees">${esc(x.name)}</a></strong> · ${esc(monthName(x.month))}</div>
            <div class="row"><span class="money">${inr(x.balance)}</span>
              ${x.phone ? `<a class="btn small wa" target="_blank" rel="noopener" href="https://wa.me/${waNumber(x.phone)}?text=${encodeURIComponent(`Hello, a gentle reminder from Mathify: fees of ${inr(x.balance)} for ${monthName(x.month)} (${x.name}) are due. Thank you!`)}">Remind</a>` : ''}</div>
          </div>`).join('') : '<p class="empty">Nothing due. 🎉</p>'}
      </div>`;
    $$('[data-end]').forEach(b => b.onclick = () => endClassModal(Number(b.dataset.end), b.dataset.start));
    $$('[data-restart]').forEach(b => b.onclick = () => changeStartModal(Number(b.dataset.restart), b.dataset.start));
    $$('[data-start-class]').forEach(b => b.onclick = () => startClassModal(Number(b.dataset.startClass)));
    $$('[data-mark]').forEach(b => b.onclick = () => attendanceModal(Number(b.dataset.mark), null, { date: d.today, start_time: b.dataset.from, end_time: b.dataset.to, is_present: 0 }));
  }

  // Start: time pre-filled with "now" (IST), editable before saving.
  function startClassModal(sid) {
    const t = nowIST();
    openModal(`<h2>Start class</h2><p class="sub">Change the time if the class actually began earlier or later.</p>
      <label for="m-start">Start time</label><input id="m-start" name="start_time" type="time" value="${t.time}" required>
      ${modalButtons('Start class')}`, async fd => {
      await api(`/students/${sid}/attendance`, { method: 'POST', body: { date: t.date, start_time: fd.get('start_time') } });
      toast('Class started at ' + fd.get('start_time')); router();
    });
  }

  // End: both start and end editable; hours and fees are recalculated from these.
  function endClassModal(id, start) {
    const t = nowIST();
    openModal(`<h2>End class</h2><p class="sub">Started at ${esc(start)}.</p>
      <div class="fields">
        <div><label for="m-start">Start time</label><input id="m-start" name="start_time" type="time" value="${esc(start)}" required></div>
        <div><label for="m-end">End time</label><input id="m-end" name="end_time" type="time" value="${t.time}" required></div>
      </div>
      ${modalButtons('End class')}`, async fd => {
      if (!fd.get('end_time')) throw new Error('Set the end time');
      await api(`/attendance/${id}`, { method: 'PUT', body: { start_time: fd.get('start_time'), end_time: fd.get('end_time') } });
      toast('Class ended'); router();
    });
  }

  function changeStartModal(id, start) {
    openModal(`<h2>Change start time</h2>
      <label for="m-start">Start time</label><input id="m-start" name="start_time" type="time" value="${esc(start)}" required>
      ${modalButtons('Save')}`, async fd => {
      await api(`/attendance/${id}`, { method: 'PUT', body: { start_time: fd.get('start_time') } });
      toast('Start time changed to ' + fd.get('start_time')); router();
    });
  }

  /* ============ admin: students ============ */
  async function studentsList() {
    const { students } = await api('/students');
    state.students = students;
    view.innerHTML = `
      <div class="row spread"><h1>Students</h1><a class="btn" href="#/students/new">+ Add student</a></div>
      <p class="sub">${students.filter(s => s.is_active).length} active · ${students.length} total</p>
      <div class="card">
        <input class="search" id="search" type="search" placeholder="Search by name, email or phone">
        <div class="table-wrap"><table>
          <thead><tr><th>Name</th><th>Grade</th><th>Mode</th><th class="num">₹/hour</th><th>Last class</th><th>Status</th></tr></thead>
          <tbody id="rows"></tbody>
        </table></div>
        <p class="empty" id="none" hidden>No students match.</p>
      </div>`;
    const draw = q => {
      q = q.toLowerCase();
      const list = students.filter(s => !q || [s.name, s.email, s.parent_email, s.phone].some(v => (v || '').toLowerCase().includes(q)));
      $('#rows').innerHTML = list.map(s => `
        <tr class="clickable" data-id="${s.id}">
          <td><strong>${esc(s.name)}</strong><br><span class="hint">${esc(s.email)}</span></td>
          <td>${esc(s.grade || '—')}</td><td>${esc(s.mode || '—')}</td>
          <td class="num">${inr(s.fee_per_hour)}</td>
          <td>${s.last_class ? esc(niceDate(s.last_class)) : '—'}</td>
          <td>${s.in_progress ? '<span class="badge amber">In class</span> ' : ''}${s.is_active ? '<span class="badge green">Active</span>' : '<span class="badge grey">Inactive</span>'}</td>
        </tr>`).join('');
      $('#none').hidden = list.length > 0 || !students.length;
      $$('#rows tr').forEach(tr => tr.onclick = () => (location.hash = '#/students/' + tr.dataset.id));
    };
    if (!students.length) $('#rows').innerHTML = '<tr><td colspan="6" class="empty">No students yet. Add one, or create one from an enquiry.</td></tr>';
    else draw('');
    $('#search').oninput = e => draw(e.target.value);
  }

  const FIELD_DEFS = [
    ['name', "Student's name *", 'text'], ['email', "Student's Google email * (to sign in)", 'email'],
    ['parent_name', "Parent's name", 'text'], ['parent_email', "Parent's Google email (can also sign in)", 'email'],
    ['phone', 'Parent/guardian WhatsApp', 'tel'], ['fee_per_hour', 'Fee per hour (₹) *', 'number'],
    ['grade', 'Grade / Year', 'text'], ['exams', 'Curriculum / target exams', 'text'],
    ['mode', 'Mode', 'select:Online,Offline'], ['hours_per_week', 'Hours per week', 'number'],
    ['dob', 'Date of birth', 'date'], ['gender', 'Gender', 'select:Male,Female,Others'],
    ['city', 'City', 'text'], ['country', 'Country', 'text'],
    ['objective', 'Objective', 'text'], ['maths_level', 'Maths level (1–10)', 'number']
  ];
  // Flexible fields, stored in the student's "details" (no database change needed).
  // To add a field: add one line here — [key (lowercase_with_underscores), label, input type].
  const DETAIL_DEFS = [
    ['student_phone', "Student's contact number", 'tel'],
    ['address_line1', 'Address line 1', 'text'], ['address_line2', 'Address line 2', 'text'],
    ['state', 'State / province / region', 'text'], ['postal_code', 'Postal / ZIP code', 'text'],
    ['parent_address', "Parent/guardian's address", 'text']
  ];

  function studentFields(s = {}) {
    const details = s.details || {};
    const field = ([k, label, type], isDetail) => {
      const v = (isDetail ? details[k] : s[k]) ?? '';
      let input;
      if (type.startsWith('select:')) {
        const opts = type.slice(7).split(',');
        input = `<select id="f-${k}" name="${k}"><option value="">—</option>${opts.map(o => `<option ${String(v).toLowerCase() === o.toLowerCase() ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
      } else {
        const extra = type === 'number' ? (k === 'maths_level' ? 'min="1" max="10" step="1"' : 'min="0" step="any"') : '';
        input = `<input id="f-${k}" name="${k}" type="${type}" value="${esc(v)}" ${extra} ${label.includes('*') ? 'required' : ''}>`;
      }
      return `<div><label for="f-${k}">${esc(label)}</label>${input}</div>`;
    };
    const sched = s.schedule || {};
    return `
      <div class="fields">${FIELD_DEFS.map(d => field(d, false)).join('')}${DETAIL_DEFS.map(d => field(d, true)).join('')}</div>
      <h2 style="margin-top:20px">Weekly schedule</h2>
      <div class="schedule-grid">${DAYS.map(d => `
        <label><input type="checkbox" name="day-${d}" ${sched[d] ? 'checked' : ''}> ${d}</label>
        <input type="time" name="from-${d}" value="${esc(sched[d]?.from || '')}" aria-label="${d} from">
        <input type="time" name="to-${d}" value="${esc(sched[d]?.to || '')}" aria-label="${d} to">`).join('')}
      </div>
      <div style="margin-top:16px"><label for="f-notes">Private notes <span class="hint">(only you see these)</span></label>
      <textarea id="f-notes" name="notes" rows="3">${esc(s.notes || '')}</textarea></div>`;
  }

  function readStudentForm(form) {
    const fd = new FormData(form);
    const out = {};
    for (const [k] of FIELD_DEFS) out[k] = fd.get(k) ?? '';
    out.details = {};
    for (const [k] of DETAIL_DEFS) { const v = (fd.get(k) || '').trim(); if (v) out.details[k] = v; }
    out.notes = fd.get('notes') || '';
    for (const k of ['fee_per_hour', 'hours_per_week', 'maths_level']) out[k] = out[k] === '' ? null : Number(out[k]);
    const schedule = {};
    for (const d of DAYS) {
      if (!fd.get('day-' + d)) continue;
      const from = fd.get('from-' + d), to = fd.get('to-' + d);
      if (!from || !to) throw new Error(`Set both times for ${d}, or untick it`);
      if (to <= from) throw new Error(`${d}: end time must be after start time`);
      schedule[d] = { from, to };
    }
    out.schedule = schedule;
    if (out.fee_per_hour == null) throw new Error('Fee per hour is required');
    return out;
  }

  // Turn an enquiry (website form or old Google Form) into Add-student form values.
  function enquiryToStudent(e) {
    const d = e.data, email = v => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '') ? v.trim() : '');
    const hours = parseFloat(d.hours), level = parseInt(d.level, 10);
    const gender = /^f/i.test(d.gender || '') ? 'Female' : /^m/i.test(d.gender || '') ? 'Male' : d.gender ? 'Others' : '';
    const extra = [['Days', d.days], ['Time', d.time], ['Demo class', d.demo], ['Heard via', d.source], ['Message', d.message]]
      .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
    return {
      name: d.student || '', email: email(d.semail), parent_name: d.parent || '', parent_email: email(d.pemail),
      phone: d.phone || '', grade: d.grade || '', exams: d.exams || '',
      mode: /offline/i.test(d.mode || '') ? 'Offline' : /online/i.test(d.mode || '') ? 'Online' : '',
      hours_per_week: hours > 0 && hours <= 40 ? hours : '', dob: /^\d{4}-\d{2}-\d{2}$/.test(d.dob || '') ? d.dob : '',
      gender, city: d.city || '', country: d.country || '', objective: d.objective || '',
      details: {
        student_phone: d.sphone || '', address_line1: d.saddr1 || '', address_line2: d.saddr2 || '', state: d.sstate || '',
        postal_code: d.spostal || '',
        parent_address: d.psame ? ((d.parent || d.phone) ? 'Same as student' : '')
          : [d.paddr1, d.paddr2, d.pcity, d.pstate, d.ppostal, d.pcountry].filter(Boolean).join(', ')
      },
      maths_level: level >= 1 && level <= 10 ? level : '',
      notes: extra.length ? `From enquiry of ${niceDate(e.created_at.slice(0, 10))}. ${extra.join('. ')}` : ''
    };
  }

  async function studentForm(id, preset, enqId) {
    let s = id ? (await api('/students/' + id)).student : (preset || {});
    let open = [], enq = null;
    if (!id) {
      open = (await api('/enquiries')).enquiries.filter(e => !e.student_id);
      enq = open.find(e => e.id === enqId) || null;
      if (enq) s = enquiryToStudent(enq);
    }
    const picker = id ? '' : `
      <div class="card">
        <label for="enq-pick">Fill from an enquiry <span class="hint">(optional)</span></label>
        <select id="enq-pick">
          <option value="">— Start blank —</option>
          ${open.map(e => `<option value="${e.id}" ${enq && enq.id === e.id ? 'selected' : ''}>${esc(e.data.student || '?')}${e.data.grade ? ' · ' + esc(e.data.grade) : ''} · ${esc(niceDate(e.created_at.slice(0, 10)))}${e.data.via ? ' · ' + esc(e.data.via) : ''}</option>`).join('')}
        </select>
        <p class="hint" style="margin:6px 0 0">${open.length ? 'Picks up the details from the enquiry; check the Google emails and set the fee.' : 'No open enquiries.'}</p>
      </div>`;
    view.innerHTML = `
      <a href="${id ? '#/students/' + id + '/details' : '#/students'}">← Back</a>
      <h1>${id ? 'Edit ' + esc(s.name) : 'Add student'}</h1>
      <p class="sub">Students and parents sign in with the Google emails below.</p>${picker}
      <form class="card" id="sform" novalidate>
        ${studentFields(s)}
        <p class="form-error" id="ferr"></p>
        <div class="row"><button class="btn" id="save">${id ? 'Save changes' : 'Add student'}</button>
        <a class="btn secondary" href="${id ? '#/students/' + id + '/details' : '#/students'}">Cancel</a></div>
      </form>`;
    if ($('#enq-pick')) $('#enq-pick').onchange = ev => { location.hash = '#/students/new' + (ev.target.value ? '/' + ev.target.value : ''); };
    $('#sform').onsubmit = e => {
      e.preventDefault();
      act($('#save'), async () => {
        $('#ferr').textContent = '';
        try {
          const data = readStudentForm(e.target);
          const r = id ? await api('/students/' + id, { method: 'PUT', body: data })
            : enq ? await api(`/enquiries/${enq.id}/convert`, { method: 'POST', body: data })
            : await api('/students', { method: 'POST', body: data });
          toast(id ? 'Saved' : 'Student added');
          location.hash = '#/students/' + r.student.id;
          if (id && data.fee_per_hour != null && data.fee_per_hour !== s.fee_per_hour) offerRateUpdate(id, data.fee_per_hour);
        } catch (err) { $('#ferr').textContent = err.message; }
      });
    };
  }

  // After a fee change: offer to re-price classes in months with no payment recorded yet.
  // Months with any payment (full or part) are never touched, so sent/paid invoices stay as they were.
  async function offerRateUpdate(sid, fee) {
    const [{ attendance }, { months }] = await Promise.all([api(`/students/${sid}/attendance`), api(`/students/${sid}/fees`)]);
    const paid = new Set(months.filter(m => m.paid).map(m => m.month));
    const targets = attendance.filter(a => !paid.has(a.date.slice(0, 7)) && a.rate !== fee);
    if (!targets.length) return;
    const monthsList = [...new Set(targets.map(a => monthName(a.date.slice(0, 7))))].join(', ');
    openModal(`<h2>Apply the new fee to earlier classes?</h2>
      <p>${targets.length} class${targets.length > 1 ? 'es' : ''} in unpaid months (${esc(monthsList)}) ${targets.length > 1 ? 'were' : 'was'} recorded at the old rate.</p>
      <p class="hint">Months already marked paid are not changed.</p>
      <div class="modal-actions"><button class="btn secondary" value="cancel">No, only new classes</button>
      <button class="btn" value="ok">Yes, charge ${inr(fee)}/hour</button></div>`, async () => {
      for (const a of targets) await api('/attendance/' + a.id, { method: 'PUT', body: { rate: fee } });
      toast(`Updated ${targets.length} class${targets.length > 1 ? 'es' : ''} to ${inr(fee)}/hour`); router();
    });
  }

  /* ============ admin: one student ============ */
  async function studentDetail(id, tab) {
    const { student: s } = await api('/students/' + id);
    state.viewing = s;
    const contact = [
      s.phone ? `<a class="btn small wa" target="_blank" rel="noopener" href="https://wa.me/${waNumber(s.phone)}">WhatsApp</a>` : '',
      s.parent_email || s.email ? `<a class="btn small secondary" href="mailto:${esc(s.parent_email || s.email)}">Email</a>` : '',
      `<a class="btn small secondary" href="#/preview/${s.id}" title="See exactly what ${esc(s.name)} and their parents see">👁 Student view</a>`
    ].filter(Boolean).join(' ');
    view.innerHTML = `
      <a href="#/students">← All students</a>
      <div class="row spread" style="margin-top:6px"><div>
        <h1>${esc(s.name)} ${s.is_active ? '' : '<span class="badge grey">Inactive</span>'}</h1>
        <p class="sub">${esc([s.grade, s.exams, s.mode].filter(Boolean).join(' · ') || '—')} · ${inr(s.fee_per_hour)}/hour</p>
      </div><div class="row">${contact}</div></div>
      <div class="pills">
        ${[['attendance', 'Attendance'], ['fees', 'Fees & invoices'], ['details', 'Details']].map(([k, t]) =>
          `<a href="#/students/${id}/${k}" class="${tab === k ? 'active' : ''}">${t}</a>`).join('')}
      </div>
      <div id="tab"></div>`;
    if (tab === 'fees') return feesTab(s, true);
    if (tab === 'details') return detailsTab(s);
    return attendanceTab(s, true);
  }

  async function attendanceTab(s, admin) {
    const { attendance } = await api(`/students/${s.id}/attendance`);
    const open = attendance.find(a => !a.end_time);
    $('#tab').innerHTML = `
      <div class="card">
        <div class="row spread"><h2>Classes</h2>
          ${admin ? `<div class="row">
            ${open ? `<button class="btn green" id="end-open">End class (started ${esc(open.start_time)})</button>`
                   : `<button class="btn" id="start-now">Start class now</button>`}
            <button class="btn secondary" id="add-past">+ Add past class</button></div>` : ''}
        </div>
        ${attendance.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Time</th><th class="num">Hours</th><th>Status</th>${admin ? '<th>Note</th><th></th>' : ''}</tr></thead>
          <tbody>${attendance.map(a => `<tr>
            <td>${esc(niceDate(a.date))}</td>
            <td>${esc(a.start_time)}–${a.end_time ? esc(a.end_time) : '<span class="badge amber">in progress</span>'}</td>
            <td class="num">${a.end_time ? a.hours : '—'}</td>
            <td><span class="badge ${STATUS[a.is_present][1]}">${STATUS[a.is_present][0]}</span></td>
            ${admin ? `<td>${esc(a.note || '')}</td><td style="white-space:nowrap">
              <button class="icon-btn" title="Edit" data-edit="${a.id}">✏️</button>
              <button class="icon-btn" title="Delete" data-del="${a.id}">🗑️</button></td>` : ''}
          </tr>`).join('')}</tbody></table></div>` : '<p class="empty">No classes recorded yet.</p>'}
      </div>`;
    if (!admin) return;
    if (open) $('#end-open').onclick = () => endClassModal(open.id, open.start_time);
    else $('#start-now').onclick = () => startClassModal(s.id);
    $('#add-past').onclick = () => attendanceModal(s.id, null, { date: nowIST().date, is_present: 1 });
    $$('[data-edit]').forEach(b => b.onclick = () => attendanceModal(s.id, attendance.find(a => a.id === Number(b.dataset.edit))));
    $$('[data-del]').forEach(b => b.onclick = () => {
      const a = attendance.find(x => x.id === Number(b.dataset.del));
      confirmModal('Delete class record?', `${esc(niceDate(a.date))}, ${esc(a.start_time)}–${esc(a.end_time || '…')}. This can't be undone.`, 'Delete', async () => {
        await api('/attendance/' + a.id, { method: 'DELETE' }); toast('Deleted'); router();
      });
    });
  }

  function attendanceModal(sid, rec, preset = {}) {
    const r = rec || preset;
    openModal(`<h2>${rec ? 'Edit class' : 'Add class'}</h2>
      <div class="fields">
        <div><label for="m-date">Date</label><input id="m-date" name="date" type="date" value="${esc(r.date || '')}" required></div>
        <div><label for="m-status">Status</label><select id="m-status" name="is_present">
          ${[1, 0, 2].map(v => `<option value="${v}" ${Number(r.is_present ?? 1) === v ? 'selected' : ''}>${STATUS[v][0]}</option>`).join('')}</select></div>
        <div><label for="m-start">Start</label><input id="m-start" name="start_time" type="time" value="${esc(r.start_time || '')}" required></div>
        <div><label for="m-endt">End <span class="hint">(blank = in progress)</span></label><input id="m-endt" name="end_time" type="time" value="${esc(r.end_time || '')}"></div>
        ${rec ? `<div><label for="m-rate">Rate ₹/hour</label><input id="m-rate" name="rate" type="number" min="0" value="${esc(rec.rate)}"></div>` : ''}
        <div class="full"><label for="m-note">Note <span class="hint">(private)</span></label><input id="m-note" name="note" value="${esc(r.note || '')}"></div>
      </div>
      <p class="hint">Late cancellation (under 3 hours' notice) is charged, as per the fees policy. Absent is not charged.</p>
      ${modalButtons(rec ? 'Save' : 'Add class')}`, async fd => {
      const body = { date: fd.get('date'), start_time: fd.get('start_time'), end_time: fd.get('end_time') || null, is_present: Number(fd.get('is_present')), note: fd.get('note') };
      if (rec) body.rate = Number(fd.get('rate'));
      if (rec) await api('/attendance/' + rec.id, { method: 'PUT', body });
      else await api(`/students/${sid}/attendance`, { method: 'POST', body });
      toast(rec ? 'Saved' : 'Class added'); router();
    });
  }

  async function feesTab(s, admin) {
    const { months } = await api(`/students/${s.id}/fees`);
    const due = months.reduce((a, m) => a + Math.max(0, m.balance), 0);
    $('#tab').innerHTML = `
      <div class="card">
        <div class="row spread"><h2>Monthly fees</h2><span>Balance due: <span class="money">${inr(due)}</span></span></div>
        ${months.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Month</th><th class="num">Classes</th><th class="num">Hours</th><th class="num">Amount</th><th>Payment</th><th></th></tr></thead>
          <tbody>${months.map(m => `<tr>
            <td><strong>${esc(monthName(m.month))}</strong></td>
            <td class="num">${m.classes}</td><td class="num">${m.hours}</td><td class="num money">${inr(m.amount)}</td>
            <td>${m.paid
              ? `<span class="badge ${m.balance > 0 ? 'amber' : 'green'}">${m.balance > 0 ? 'Part paid' : 'Paid'} ${inr(m.paid.amount)}</span><br><span class="hint">${esc(m.paid.method)} · ${esc(niceDate(m.paid.paid_on))}</span>`
              : m.amount > 0 ? '<span class="badge red">Unpaid</span>' : '<span class="badge grey">—</span>'}</td>
            <td style="white-space:nowrap">
              ${admin ? (m.paid ? `<button class="btn small secondary" data-unpay="${m.month}">Undo</button>` : `<button class="btn small green" data-pay="${m.month}">Mark paid</button>`) : ''}
              <button class="btn small secondary" data-inv="${m.month}">Invoice</button>
            </td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No fees yet — they appear once classes are recorded.</p>'}
        <p class="hint">Fees = hours × rate for each class (present or late-cancelled), rounded to the nearest 15 minutes.</p>
      </div>`;
    $$('[data-inv]').forEach(b => b.onclick = () => act(b, () => invoiceModal(s, b.dataset.inv, admin)));
    if (!admin) return;
    $$('[data-pay]').forEach(b => b.onclick = () => {
      const m = months.find(x => x.month === b.dataset.pay);
      openModal(`<h2>Mark ${esc(monthName(m.month))} as paid</h2>
        <div class="fields">
          <div><label for="p-amt">Amount received (₹)</label><input id="p-amt" name="amount" type="number" min="0" value="${m.balance}" required></div>
          <div><label for="p-method">Method</label><select id="p-method" name="method"><option>UPI</option><option>Cash</option><option>Bank transfer</option></select></div>
          <div><label for="p-date">Payment date</label><input id="p-date" name="paid_on" type="date" value="${nowIST().date}" required></div>
        </div>
        <p class="hint">Amount due for this month: ${inr(m.amount)}.</p>
        ${modalButtons('Mark paid')}`, async fd => {
        await api(`/students/${s.id}/payments/${m.month}`, { method: 'PUT', body: { amount: Number(fd.get('amount')), method: fd.get('method'), paid_on: fd.get('paid_on') } });
        toast('Payment recorded'); router();
      });
    });
    $$('[data-unpay]').forEach(b => b.onclick = () => confirmModal('Undo payment?', `Removes the payment record for ${esc(monthName(b.dataset.unpay))}.`, 'Undo payment', async () => {
      await api(`/students/${s.id}/payments/${b.dataset.unpay}`, { method: 'DELETE' }); toast('Payment removed'); router();
    }));
  }

  function detailsTab(s) {
    const row = (k, v) => v || v === 0 ? `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>` : '';
    const dt = s.details || {};
    const shown = ['student_phone', 'address_line1', 'address_line2', 'state', 'postal_code', 'parent_address'];
    const label = k => (DETAIL_DEFS.find(d => d[0] === k) || [k, k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())])[1];
    const extraDetails = Object.keys(dt).filter(k => !shown.includes(k)).map(k => row(label(k), dt[k])).join('');
    const sched = DAYS.filter(d => s.schedule[d]).map(d => `${d} ${s.schedule[d].from}–${s.schedule[d].to}`).join(', ');
    $('#tab').innerHTML = `
      <div class="card"><dl class="kv">
        ${row('Student email (login)', s.email)}${row("Student's phone", dt.student_phone)}${row("Parent/guardian's name", s.parent_name)}${row('Parent/guardian email (login)', s.parent_email)}
        ${row('Parent/guardian WhatsApp', s.phone)}${row('Fee per hour', inr(s.fee_per_hour))}${row('Weekly schedule', sched || 'Not set')}
        ${row('Grade', s.grade)}${row('Curriculum / exams', s.exams)}${row('Mode', s.mode)}${row('Hours per week', s.hours_per_week)}
        ${row('Date of birth', s.dob)}${row('Gender', s.gender)}${row('Address', [dt.address_line1, dt.address_line2, s.city, dt.state, dt.postal_code, s.country].filter(Boolean).join(', '))}${row("Parent/guardian's address", dt.parent_address)}
        ${row('Objective', s.objective)}${row('Maths level (1–10)', s.maths_level)}${extraDetails}${row('Private notes', s.notes)}${row('Added', s.created_at.slice(0, 10))}
      </dl></div>
      <div class="row">
        <a class="btn" href="#/students/${s.id}/edit">Edit</a>
        <button class="btn secondary" id="toggle">${s.is_active ? 'Deactivate' : 'Reactivate'}</button>
        <button class="btn danger" id="delete">Delete student</button>
      </div>
      <p class="hint">Deactivating stops the student and parent signing in and hides them from today's schedule; records are kept.</p>`;
    $('#toggle').onclick = e => act(e.target, async () => {
      await api('/students/' + s.id, { method: 'PUT', body: { is_active: !s.is_active } });
      toast(s.is_active ? 'Deactivated' : 'Reactivated'); router();
    });
    $('#delete').onclick = () => openModal(`<h2>Delete ${esc(s.name)}?</h2>
      <p>This permanently deletes the student and <strong>all their classes and payments</strong>. To keep records, deactivate instead.</p>
      <label for="m-confirm">Type the student's name to confirm</label><input id="m-confirm" name="confirm" autocomplete="off">
      ${modalButtons('Delete permanently', true)}`, async fd => {
      if ((fd.get('confirm') || '').trim() !== s.name) throw new Error('Name does not match');
      await api('/students/' + s.id, { method: 'DELETE' }); toast('Student deleted'); location.hash = '#/students';
    });
  }

  /* ============ invoices ============ */
  function buildInvoicePDF(inv) {
    if (!window.jspdf) throw new Error('PDF library is still loading, try again in a moment');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), L = 48, R = W - 48;
    let y = 56;
    doc.setFillColor(255, 213, 79); doc.rect(0, 0, W, 8, 'F');
    if (state.logo) doc.addImage(state.logo, 'PNG', L, y - 36, 142, 40);
    else { doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.setTextColor(47, 49, 146); doc.text('MATHIFY', L, y); }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(31, 42, 55); doc.text('INVOICE', R, y, { align: 'right' });
    y += 18; doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(93, 102, 117);
    doc.text(`${inv.business.owner} · ${inv.business.city}`, L, y);
    doc.text(`Invoice no: ${inv.invoice_number}`, R, y, { align: 'right' });
    y += 14;
    const contact = [inv.business.whatsapp ? 'WhatsApp +' + inv.business.whatsapp : '', inv.business.email].filter(Boolean).join(' · ');
    doc.text(contact, L, y); doc.text(`Date: ${inv.issued_on}`, R, y, { align: 'right' });
    y += 34;
    doc.setTextColor(31, 42, 55); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Billed to', L, y); doc.text('Period', R, y, { align: 'right' });
    doc.setFont('helvetica', 'normal'); y += 15;
    doc.text(inv.student.name, L, y); doc.text(monthName(inv.month), R, y, { align: 'right' });
    if (inv.student.parent_name) { y += 14; doc.text('Parent: ' + inv.student.parent_name, L, y); }
    y += 30;
    const cols = [L, L + 110, L + 210, L + 330, R - 80, R];
    const head = ['Date', 'Time', 'Status', 'Hours', 'Rate', 'Amount'];
    doc.setFillColor(242, 243, 251); doc.rect(L - 6, y - 13, R - L + 12, 20, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    head.forEach((h, i) => doc.text(h, i >= 3 ? cols[i] + (i === 3 ? 30 : 0) : cols[i], y, i >= 3 ? { align: 'right' } : undefined));
    doc.setFont('helvetica', 'normal'); y += 22;
    for (const l of inv.lines) {
      if (y > 760) { doc.addPage(); y = 60; }
      const status = l.is_present === 2 ? 'Late cancel' : 'Present';
      doc.text(l.date, cols[0], y); doc.text(`${l.start_time}-${l.end_time}`, cols[1], y); doc.text(status, cols[2], y);
      doc.text(String(l.hours), cols[3] + 30, y, { align: 'right' }); doc.text(rs(l.rate), cols[4], y, { align: 'right' }); doc.text(rs(l.amount), cols[5], y, { align: 'right' });
      y += 18;
    }
    if (!inv.lines.length) { doc.setTextColor(93, 102, 117); doc.text('No chargeable classes this month.', L, y); y += 18; doc.setTextColor(31, 42, 55); }
    y += 6; doc.setDrawColor(227, 229, 239); doc.line(L - 6, y, R + 6, y); y += 20;
    const total = (label, val, bold) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.text(label, R - 140, y, { align: 'right' }); doc.text(val, R, y, { align: 'right' }); y += 18; };
    total('Total hours', String(inv.total_hours));
    total('Total', rs(inv.total), true);
    if (inv.paid) total(`Paid (${inv.paid.method}, ${inv.paid.paid_on})`, '- ' + rs(inv.paid.amount));
    doc.setTextColor(inv.balance > 0 ? 180 : 23, inv.balance > 0 ? 35 : 128, inv.balance > 0 ? 24 : 61);
    total(inv.balance > 0 ? 'Balance due' : 'Balance', rs(Math.max(0, inv.balance)), true);
    doc.setTextColor(93, 102, 117); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    y += 20;
    doc.text('Fees are charged per hour and payable between the 1st and 5th of the following month.', L, y); y += 13;
    doc.text('Classes cancelled with under 3 hours\' notice are charged. Thank you for learning with Mathify!', L, y);
    return doc;
  }

  async function invoiceModal(s, month, admin) {
    const inv = await api(`/students/${s.id}/invoice/${month}`);
    const filename = `Mathify-invoice-${inv.student.name.replace(/[^\w]+/g, '-')}-${month}.pdf`;
    const summary = `Mathify invoice ${inv.invoice_number} for ${inv.student.name}, ${monthName(month)}: ${inv.total_hours} hours, total ${inr(inv.total)}` +
      (inv.paid ? `, paid ${inr(inv.paid.amount)}` : '') + (inv.balance > 0 ? `. Balance due: ${inr(inv.balance)}.` : '. Fully paid — thank you!') +
      `\nDetails: ${location.origin}/app/`;
    const canShareFile = !!(navigator.canShare && window.File && navigator.canShare({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] }));
    const to = s.parent_email || s.email;
    openModal(`<h2>Invoice · ${esc(monthName(month))}</h2>
      <dl class="kv"><dt>Invoice no.</dt><dd>${esc(inv.invoice_number)}</dd><dt>Classes</dt><dd>${inv.lines.length} (${inv.total_hours} hours)</dd>
      <dt>Total</dt><dd class="money">${inr(inv.total)}</dd>${inv.paid ? `<dt>Paid</dt><dd>${inr(inv.paid.amount)} · ${esc(inv.paid.method)}</dd>` : ''}
      <dt>Balance</dt><dd class="money">${inr(Math.max(0, inv.balance))}</dd></dl>
      <div class="row" style="margin-top:16px">
        <button type="button" class="btn" id="inv-dl">Download PDF</button>
        ${admin && canShareFile ? '<button type="button" class="btn wa" id="inv-share">Share PDF…</button>' : ''}
        ${admin && s.phone ? `<a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/${waNumber(s.phone)}?text=${encodeURIComponent('Hello! ' + summary)}">Send on WhatsApp</a>` : ''}
        ${admin && to ? `<a class="btn secondary" href="mailto:${esc(to)}?subject=${encodeURIComponent('Mathify invoice — ' + monthName(month))}&body=${encodeURIComponent('Hello,\n\n' + summary + '\n\nThe PDF invoice is attached.\n\nRegards,\nTanmay Mogra\nMathify')}">Email</a>` : ''}
      </div>
      ${admin ? `<p class="hint">WhatsApp and email open with the summary filled in. ${canShareFile ? '“Share PDF” attaches the PDF directly (phones).' : 'Download the PDF first if you want to attach it.'}</p>` : ''}
      <div class="modal-actions"><button class="btn secondary" value="cancel">Close</button></div>`, async () => {});
    $('#inv-dl').onclick = () => { try { buildInvoicePDF(inv).save(filename); } catch (e) { toast(e.message, true); } };
    const sh = $('#inv-share');
    if (sh) sh.onclick = async () => {
      try {
        const blob = buildInvoicePDF(inv).output('blob');
        await navigator.share({ files: [new File([blob], filename, { type: 'application/pdf' })], text: summary });
      } catch (e) { if (e.name !== 'AbortError') toast(e.message, true); }
    };
  }

  /* ============ admin: enquiries ============ */
  async function enquiries(filter) {
    const { enquiries: all } = await api('/enquiries');
    const counts = { new: 0, contacted: 0, converted: 0, closed: 0 };
    all.forEach(e => counts[e.status]++);
    state.newEnquiries = counts.new; setTabs();
    const list = filter === 'all' ? all : all.filter(e => e.status === filter);
    const L = { student: 'Student', grade: 'Grade', exams: 'Curriculum / exams', parent: 'Parent/guardian', phone: 'Parent/guardian WhatsApp', pemail: 'Parent/guardian email',
      semail: 'Student email', sphone: "Student's phone", saddr1: 'Address line 1', saddr2: 'Address line 2', city: 'City', sstate: 'State / province',
      spostal: 'Postal code', country: 'Country', psame: 'Parent address same as student', paddr1: 'Parent address line 1', paddr2: 'Parent address line 2',
      pcity: 'Parent city', pstate: 'Parent state', ppostal: 'Parent postal code', pcountry: 'Parent country', mode: 'Mode', hours: 'Hours/week', days: 'Days', time: 'Time',
      objective: 'Objective', level: 'Maths level', demo: 'Demo class', source: 'Heard via', dob: 'DOB', gender: 'Gender', message: 'Message', via: 'Came via' };
    view.innerHTML = `
      <h1>Enquiries</h1><p class="sub">From the website enquiry form, plus older Google Form responses.</p>
      <div class="pills">${['new', 'contacted', 'converted', 'closed', 'all'].map(k =>
        `<a href="#/enquiries/${k}" class="${filter === k ? 'active' : ''}">${k[0].toUpperCase() + k.slice(1)}${k !== 'all' ? ' (' + counts[k] + ')' : ''}</a>`).join('')}</div>
      ${list.length ? list.map(e => `
        <div class="card">
          <div class="row spread">
            <div><h2 style="margin:0">${esc(e.data.student)}${e.data.grade ? ' · ' + esc(e.data.grade) : ''}</h2>
              <span class="hint">${esc(niceDate(e.created_at.slice(0, 10)))}</span></div>
            <div class="row">
              ${e.data.phone ? `<a class="btn small wa" target="_blank" rel="noopener" href="https://wa.me/${waNumber(e.data.phone)}?text=${encodeURIComponent(`Hello ${e.data.parent || ''}, this is Tanmay from Mathify — thank you for your enquiry about Maths classes for ${e.data.student}.`)}">WhatsApp</a>` : ''}
              ${e.student_id ? `<a class="btn small secondary" href="#/students/${e.student_id}">View student</a>` : `<button class="btn small" data-convert="${e.id}">Create student</button>`}
              <select class="small-select" data-status="${e.id}" aria-label="Status" style="width:auto">
                ${['new', 'contacted', 'converted', 'closed'].map(st => `<option ${st === e.status ? 'selected' : ''}>${st}</option>`).join('')}</select>
            </div>
          </div>
          <dl class="kv" style="margin-top:12px">${Object.keys(L).filter(k => e.data[k] && k !== 'student').map(k => `<dt>${L[k]}</dt><dd>${esc(e.data[k])}</dd>`).join('')}</dl>
        </div>`).join('') : '<p class="empty">No enquiries here.</p>'}`;
    $$('[data-status]').forEach(sel => sel.onchange = () => act(null, async () => {
      await api('/enquiries/' + sel.dataset.status, { method: 'PUT', body: { status: sel.value } }); toast('Updated'); router();
    }));
    $$('[data-convert]').forEach(b => b.onclick = () => { location.hash = '#/students/new/' + b.dataset.convert; });
  }

  /* ============ student / parent view ============ */
  // previewId: admin-only preview of a student's page (read-only, same view the student/parent gets)
  async function studentHome(sidParam, previewId) {
    const kids = previewId ? [] : state.me.students;
    const sid = previewId || (sidParam && kids.some(k => k.id === sidParam) ? sidParam : kids[0].id);
    const { student: s } = await api('/students/' + sid);
    const sched = DAYS.filter(d => s.schedule[d]).map(d => `${d} ${s.schedule[d].from}–${s.schedule[d].to}`).join(' · ');
    view.innerHTML = `
      ${previewId ? `<div class="preview-banner"><span>👁 Preview: this is what <b>${esc(s.name)}</b> and their parents see when they sign in.${s.is_active ? '' : ' (Inactive students can’t sign in.)'}</span><a class="btn small" href="#/students/${s.id}">Back to admin</a></div>` : ''}
      ${kids.length > 1 ? `<div class="pills">${kids.map(k => `<a href="#/student/${k.id}" class="${k.id === sid ? 'active' : ''}">${esc(k.name)}</a>`).join('')}</div>` : ''}
      <h1>${esc(s.name)}</h1>
      <p class="sub">${esc(sched || 'Schedule to be confirmed')} · ${inr(s.fee_per_hour)}/hour</p>
      <div id="tab"></div><div id="tab2"></div>
      <p class="hint">Questions about classes or fees? <a href="https://wa.me/919766072237" target="_blank" rel="noopener">WhatsApp Tanmay</a>.</p>`;
    await feesTab(s, false);
    const feesHTML = $('#tab').innerHTML;
    const handlers = $$('[data-inv]', $('#tab')).map(b => b.dataset.inv);
    await attendanceTab(s, false);
    $('#tab2').innerHTML = $('#tab').innerHTML;
    $('#tab').innerHTML = feesHTML;
    $$('[data-inv]', $('#tab')).forEach((b, i) => b.onclick = () => act(b, () => invoiceModal(s, handlers[i], false)));
  }

  /* ============ start ============ */
  (async function init() {
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin' });
      if (res.status !== 200) return renderLogin();
      state.me = await res.json();
      if (location.search) history.replaceState(null, '', '/app/' + location.hash);
      router();
    } catch { renderLogin(); }
  })();
})();
