/* Enquiry form: builds the enquiry and opens WhatsApp or the visitor's email app,
   and saves a copy to the Mathify app (Enquiries tab).
   Rules (also enforced on the server, functions/api/[[path]].js):
   - student's name, date of birth and Gmail address are required;
   - parent/guardian name, WhatsApp number and Gmail are required unless the student is 18+;
   - for an 18+ student with no parent/guardian number, the student's contact number is required. */
(function () {
  var WHATSAPP_NUMBER = '919766072237';     // country code + number, digits only
  var EMAIL = 'tanmaym88@gmail.com';
  var GMAIL = /^[^\s@]+@(gmail|googlemail)\.com$/i;

  var form = document.getElementById('enquiry');
  if (!form) return;
  var err = document.getElementById('form-error');

  function val(name) {
    var el = form.elements[name];
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked ? 'Yes' : '';
    return (el.value || '').trim();
  }

  // Age in whole years from a YYYY-MM-DD date (null if not set / invalid).
  function age(dob) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob || '');
    if (!m) return null;
    var now = new Date(), a = now.getFullYear() - +m[1];
    if (now.getMonth() + 1 < +m[2] || (now.getMonth() + 1 === +m[2] && now.getDate() < +m[3])) a--;
    return a;
  }
  function isAdult() { var a = age(val('dob')); return a !== null && a >= 18; }

  // Show / hide "required" markers and the 18+ note as the date of birth changes.
  var dobEl = form.elements.dob;
  dobEl.max = new Date().toISOString().slice(0, 10);
  function updateParentRules() {
    var adult = isAdult();
    document.getElementById('adult-note').hidden = !adult;
    Array.prototype.forEach.call(document.querySelectorAll('.preq'), function (s) { s.hidden = adult; });
    ['parent', 'phone', 'pemail'].forEach(function (n) { form.elements[n].required = !adult; });
    document.getElementById('sphone-req').hidden = !(adult && !val('phone'));
  }
  dobEl.addEventListener('input', updateParentRules);
  dobEl.addEventListener('change', updateParentRules);
  form.elements.phone.addEventListener('input', updateParentRules);

  // Parent/guardian address: hidden while "Same as the student's address" is ticked.
  var same = form.elements.psame, paddr = document.getElementById('paddr');
  function updateAddr() { paddr.hidden = same.checked; }
  same.addEventListener('change', updateAddr);
  updateAddr(); updateParentRules();

  function joinAddr(p, city, country) {
    return [val(p + 'addr1'), val(p + 'addr2'), val(city), val(p + 'state'), val(p + 'postal'), val(country)]
      .filter(Boolean).join(', ');
  }

  // [field name, label in the message]
  var FIELDS = [
    ['student', "Student's name"], ['gender', 'Gender'], ['dob', 'Date of birth'], ['grade', 'Grade / Year'],
    ['semail', "Student's Gmail"], ['sphone', "Student's contact number"],
    ['saddr1', 'Address line 1'], ['saddr2', 'Address line 2'], ['city', 'City'], ['sstate', 'State / province'],
    ['spostal', 'Postal code'], ['country', 'Country'],
    ['parent', "Parent/guardian's name"], ['phone', 'Parent/guardian WhatsApp'], ['pemail', "Parent/guardian's Gmail"],
    ['psame', 'Parent address same as student'],
    ['paddr1', 'Parent address line 1'], ['paddr2', 'Parent address line 2'], ['pcity', 'Parent city'],
    ['pstate', 'Parent state / province'], ['ppostal', 'Parent postal code'], ['pcountry', 'Parent country'],
    ['exams', 'Curriculum / target exams'], ['objective', 'Objective'], ['mode', 'Preferred mode'],
    ['hours', 'Hours per week'], ['days', 'Preferred days'], ['time', 'Preferred time (IST)'],
    ['level', 'Maths level (1-10)'], ['demo', 'Demo class'], ['source', 'Heard about Mathify via']
  ];
  var PARENT_ADDR = ['paddr1', 'paddr2', 'pcity', 'pstate', 'ppostal', 'pcountry'];
  function included(name) { return !(same.checked && PARENT_ADDR.indexOf(name) !== -1); }

  function buildMessage() {
    var lines = ['Hello Tanmay, this is an enquiry for Maths classes at Mathify.', ''];
    var sAddr = joinAddr('s', 'city', 'country');
    lines.push("Student's name: " + val('student'));
    ['gender', 'dob', 'grade', 'semail', 'sphone'].forEach(function (n) {
      var f = FIELDS.filter(function (x) { return x[0] === n; })[0]; if (val(n)) lines.push(f[1] + ': ' + val(n));
    });
    if (sAddr) lines.push("Student's address: " + sAddr);
    if (isAdult()) lines.push('(Student is 18 or older.)');
    ['parent', 'phone', 'pemail'].forEach(function (n) {
      var f = FIELDS.filter(function (x) { return x[0] === n; })[0]; if (val(n)) lines.push(f[1] + ': ' + val(n));
    });
    if (same.checked) { if (sAddr && (val('parent') || val('phone'))) lines.push("Parent/guardian's address: same as student's"); }
    else { var pAddr = joinAddr('p', 'pcity', 'pcountry'); if (pAddr) lines.push("Parent/guardian's address: " + pAddr); }
    ['exams', 'objective', 'mode', 'hours', 'days', 'time', 'level', 'demo', 'source'].forEach(function (n) {
      var f = FIELDS.filter(function (x) { return x[0] === n; })[0]; if (val(n)) lines.push(f[1] + ': ' + val(n));
    });
    if (val('message')) { lines.push(''); lines.push(val('message')); }
    return lines.join('\n');
  }

  function fail(msg, name) {
    err.textContent = msg;
    var el = form.elements[name];
    if (el && el.focus) el.focus();
    return false;
  }

  function check() {
    err.textContent = '';
    if (!val('student')) return fail("Please enter the student's name.", 'student');
    var a = age(val('dob'));
    if (a === null) return fail("Please enter the student's date of birth.", 'dob');
    if (a < 2 || a > 100) return fail('Please check the date of birth.', 'dob');
    if (!val('semail')) return fail("Please enter the student's Gmail address (it's used to sign in to the Mathify app).", 'semail');
    if (!GMAIL.test(val('semail'))) return fail("The student's email must be a Gmail address (ending in @gmail.com).", 'semail');
    if (val('sphone') && val('sphone').replace(/\D/g, '').length < 8) return fail("The student's contact number looks too short.", 'sphone');
    if (a < 18) {
      if (!val('parent')) return fail("Please enter the parent/guardian's name.", 'parent');
      if (val('phone').replace(/\D/g, '').length < 8) return fail("Please enter the parent/guardian's WhatsApp number so Tanmay can reply.", 'phone');
      if (!val('pemail')) return fail("Please enter the parent/guardian's Gmail address.", 'pemail');
    } else if (val('phone').replace(/\D/g, '').length < 8 && val('sphone').replace(/\D/g, '').length < 8) {
      return fail("Please enter a contact number (the student's or a parent/guardian's) so Tanmay can reply.", 'sphone');
    }
    if (val('pemail') && !GMAIL.test(val('pemail'))) return fail("The parent/guardian's email must be a Gmail address (ending in @gmail.com).", 'pemail');
    return true;
  }

  // Save a copy of the enquiry to Mathify's app (once per page visit). Fails silently — the
  // WhatsApp / email message still goes out either way.
  var saved = false;
  function saveCopy() {
    if (saved || !window.fetch) return;
    saved = true;
    var data = {};
    FIELDS.forEach(function (f) { if (included(f[0]) && val(f[0])) data[f[0]] = val(f[0]); });
    if (val('message')) data.message = val('message');
    data.website = val('website'); // honeypot
    try {
      fetch('/api/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), keepalive: true })
        .catch(function () {});
    } catch (e) { /* ignore */ }
  }

  document.getElementById('send-wa').addEventListener('click', function () {
    if (!check()) return;
    saveCopy();
    var url = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(buildMessage());
    window.open(url, '_blank', 'noopener');
  });

  // The email button is a real mailto: link; we fill in subject + body just before it opens.
  document.getElementById('send-mail').addEventListener('click', function (e) {
    if (!check()) { e.preventDefault(); return; }
    saveCopy();
    var subject = 'Mathify enquiry — ' + val('student');
    this.href = 'mailto:' + EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(buildMessage());
  });

  form.addEventListener('submit', function (e) { e.preventDefault(); });
})();
