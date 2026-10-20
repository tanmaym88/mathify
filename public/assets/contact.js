/* Enquiry form: builds the enquiry and opens WhatsApp or the visitor's email app.
   Same questions as the old "Mathify: Form for Enquiry" Google Form.
   No server, no third-party form service — nothing is stored on the website. */
(function () {
  var WHATSAPP_NUMBER = '919766072237';     // country code + number, digits only
  var EMAIL = 'tanmaym88@gmail.com';

  var form = document.getElementById('enquiry');
  if (!form) return;
  var err = document.getElementById('form-error');

  function val(name) {
    var el = form.elements[name];
    if (!el) return '';
    if (el instanceof RadioNodeList) return (el.value || '').trim();
    return (el.value || '').trim();
  }

  // [field name, label in the message]
  var FIELDS = [
    ['student', "Student's name"], ['gender', 'Gender'], ['dob', 'Date of birth'],
    ['grade', 'Grade / Year'], ['exams', 'Curriculum / target exams'], ['semail', "Student's email"],
    ['parent', "Parent's name"], ['phone', 'WhatsApp number'], ['pemail', "Parent's email"],
    ['city', 'City'], ['country', 'Country'],
    ['objective', 'Objective'], ['mode', 'Preferred mode'], ['hours', 'Hours per week'],
    ['days', 'Preferred days'], ['time', 'Preferred time (IST)'],
    ['level', 'Maths level (1-10)'], ['demo', 'Demo class'], ['source', 'Heard about Mathify via']
  ];

  function buildMessage() {
    var lines = ['Hello Tanmay, this is an enquiry for Maths classes at Mathify.', ''];
    FIELDS.forEach(function (f) { if (val(f[0])) lines.push(f[1] + ': ' + val(f[0])); });
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
    if (!val('parent')) return fail("Please enter the parent's name.", 'parent');
    if (val('phone').replace(/\D/g, '').length < 8) return fail('Please enter a WhatsApp number so Tanmay can reply.', 'phone');
    if (val('semail') && !form.elements.semail.checkValidity()) return fail('The student email doesn’t look right.', 'semail');
    if (val('pemail') && !form.elements.pemail.checkValidity()) return fail('The parent email doesn’t look right.', 'pemail');
    return true;
  }

  // Save a copy of the enquiry to Mathify's app (once per page visit). Fails silently — the
  // WhatsApp / email message still goes out either way.
  var saved = false;
  function saveCopy() {
    if (saved || !window.fetch) return;
    saved = true;
    var data = {};
    FIELDS.forEach(function (f) { if (val(f[0])) data[f[0]] = val(f[0]); });
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
