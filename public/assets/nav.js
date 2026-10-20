/* Mobile menu toggle + About dropdown (no jQuery, no Webflow runtime). */
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;

  var toggle = header.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('menu-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? '✕' : '☰';
    });
  }

  header.querySelectorAll('.dropdown').forEach(function (dd) {
    var btn = dd.querySelector('.dd-btn');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = dd.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  document.addEventListener('click', function () {
    header.querySelectorAll('.dropdown.open').forEach(function (dd) {
      dd.classList.remove('open');
      dd.querySelector('.dd-btn').setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      header.classList.remove('menu-open');
      if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = '☰'; }
    }
  });
})();
