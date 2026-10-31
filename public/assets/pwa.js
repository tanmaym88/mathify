// Registers the service worker and shows an "Install the app" button where the browser allows it.
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    document.querySelectorAll('[data-install]').forEach(function (b) { b.hidden = false; });
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-install]');
    if (!b || !deferred) return;
    deferred.prompt();
    deferred.userChoice.finally(function () { deferred = null; document.querySelectorAll('[data-install]').forEach(function (x) { x.hidden = true; }); });
  });
  window.addEventListener('appinstalled', function () { document.querySelectorAll('[data-install]').forEach(function (x) { x.hidden = true; }); });
})();
