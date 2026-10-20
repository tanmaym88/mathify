/* Live fee table: reads hourly rates from the "Mathify – Website Rates" Google Sheet.
   Edit the sheet → the website updates on the next page load (no code change, no redeploy).
   If the sheet can't be reached, the rates already written in the page are shown instead. */
(function () {
  var SHEET_ID = '1S7OSoEuljcbmbkCtlEAFBcEAx7LORYxjX22T4CQ6Ocw';
  var TAB = 'Rates';
  var URL = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID +
            '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(TAB);

  var table = document.querySelector('table.fees[data-live]');
  if (!table || !window.fetch) return;

  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.map(function (r) { return r.map(function (c) { return c.trim(); }); });
  }

  function money(v) {
    var n = Number(String(v).replace(/[^\d.]/g, ''));
    if (!v || !isFinite(n) || n <= 0) return '—';
    return '₹' + n.toLocaleString('en-IN');
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  // Keep the table invisible while the sheet loads, so hidden rates never flash on screen.
  // (If the sheet is slow or unreachable, the built-in rates appear after a few seconds.)
  table.classList.add('rates-loading');
  var shown = false;
  function reveal() { if (!shown) { shown = true; table.classList.remove('rates-loading'); } }
  var failSafe = setTimeout(reveal, 4000);

  function hideAll() {
    table.hidden = true;
    var note = document.createElement('p');
    note.className = 'fees-on-request';
    note.innerHTML = 'Fees are shared on request. Please <a href="https://wa.me/919766072237" target="_blank" rel="noopener">WhatsApp</a> or use the <a href="/contact">contact form</a>.';
    table.parentNode.insertBefore(note, table);
    table.setAttribute('data-source', 'sheet-hidden');
  }

  fetch(URL, { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (text) {
      if (/^\s*</.test(text)) throw new Error('not shared'); // sign-in page instead of CSV
      var rows = parseCSV(text).slice(1);                     // drop header row
      var body = [], effective = '';
      rows.forEach(function (r) {
        if (!r[0]) return;
        if (/^effective/i.test(r[0])) { effective = r[1] || ''; return; }
        if ((r[4] || 'Yes').toLowerCase().indexOf('n') === 0) return;   // "Show on website" = No
        if (!r[1] && !r[2] && !r[3]) return;
        body.push('<tr><th scope="row">' + esc(r[0]) + '</th><td>' + money(r[1]) +
                  '</td><td>' + money(r[2]) + '</td><td>' + money(r[3]) + '</td></tr>');
      });
      clearTimeout(failSafe);
      if (!body.length) { hideAll(); shown = true; return; }   // every row set to "No": hide the table
      table.querySelector('tbody').innerHTML = body.join('');
      if (effective) {
        table.querySelector('caption').textContent = 'Hourly rates in INR, with effect from ' + effective;
      }
      table.setAttribute('data-source', 'sheet');
      reveal();
    })
    .catch(function () { clearTimeout(failSafe); reveal(); /* keep the built-in rates */ });
})();
