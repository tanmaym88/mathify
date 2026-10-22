/* Mathify puzzle gate.
   Visitors must solve the counting puzzle on the home page before other pages open.
   Load this in <head> (not deferred) so locked pages never flash. */
(function () {
  var REQUIRED = false;                     // false = the puzzle is optional; set true to make visitors solve it first
  if (!REQUIRED) return;
  var HOME = '/aptitude-test';             // the puzzle page
  var ALWAYS_OPEN = ['/feedback', '/login', '/app', '/privacy', '/terms']; // pages anyone may open without solving (edit or empty this list)
  var UNLOCK_KEY = 'mathifyUnlocked';      // must match assets/puzzle.js

  var path = location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/';
  if (path === HOME || ALWAYS_OPEN.indexOf(path) !== -1) return;

  var unlocked = false;
  try { unlocked = localStorage.getItem(UNLOCK_KEY) === '1'; }
  catch (e) { unlocked = true; }           // if the browser blocks storage, don't lock the visitor out

  if (!unlocked) {
    document.documentElement.style.visibility = 'hidden'; // avoid a flash of the page
    location.replace(HOME);
  }
})();
