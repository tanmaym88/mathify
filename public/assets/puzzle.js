/* Mathify Counting Order Puzzle (home page).
   Drag the cards into the boxes in counting order: 1 dog, 2 hands, 3 flowers ... 9 leaves.
   Solving it unlocks the rest of the site (see assets/gate.js). */
(function () {
  // ===== EDIT HERE =====
  // [image path, singular, plural]  — order = 1, 2, 3 ...
  var ITEMS = [
    ['/images/1dog.webp',      'dog',    'dogs'],
    ['/images/2hands.webp',    'hand',   'hands'],
    ['/images/3flowers.webp',  'flower', 'flowers'],
    ['/images/4trees.webp',    'tree',   'trees'],
    ['/images/5cats.webp',     'cat',    'cats'],
    ['/images/6rocks.webp',    'rock',   'rocks'],
    ['/images/7pigeons.webp',  'pigeon', 'pigeons'],
    ['/images/8fishes.webp',   'fish',   'fish'],
    ['/images/9leaves.webp',   'leaf',   'leaves']
  ];
  var REPEAT_IMAGE = false;
  var ALLOW_DESCENDING = false;
  var NEXT_URL = '/welcome';          // page to open after solving
  var UNLOCK_KEY = 'mathifyUnlocked'; // must match assets/gate.js
  // =====================

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('cop-stage'), scatter = $('cop-scatter'), slotsEl = $('cop-slots'), msg = $('cop-msg'), overlay = $('cop-overlay');
  var N = ITEMS.length, cards = [], slots = [], occupant = new Array(N).fill(null);

  for (var i = 0; i < N; i++) {
    var s = document.createElement('div');
    s.className = 'cop-slot';
    if (i < N - 1) s.innerHTML = '<span class="cop-arrow">▶</span>';
    slotsEl.appendChild(s); slots.push(s);
  }

  ITEMS.forEach(function (it, idx) {
    var count = idx + 1, c = document.createElement('div');
    c.className = 'cop-card';
    c.dataset.count = count;
    c.setAttribute('aria-label', count + ' ' + (count === 1 ? it[1] : it[2]));
    var img = '<img src="' + it[0] + '" alt="' + it[1] + '" draggable="false">';
    if (REPEAT_IMAGE) {
      var cols = Math.ceil(Math.sqrt(count));
      c.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
      c.innerHTML = new Array(count).fill(img).join('');
    } else {
      c.classList.add('single');
      c.innerHTML = img;
    }
    stage.appendChild(c); cards.push(c); addDrag(c);
  });

  function rel(el) { var s = stage.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height }; }
  function setPos(c, x, y) { c.style.left = x + 'px'; c.style.top = y + 'px'; c._x = x; c._y = y; }
  function size() { return cards[0].offsetWidth; }
  function slotPos(i) { var r = rel(slots[i]), z = size(); return { x: r.x + (r.w - z) / 2, y: r.y + (r.h - z) / 2 }; }
  function snapTo(c, x, y) { c.classList.add('snap'); setPos(c, x, y); setTimeout(function () { c.classList.remove('snap'); }, 220); }
  function placeInSlot(c, i) { occupant[i] = c; c._slot = i; var p = slotPos(i); snapTo(c, p.x, p.y); }

  function randomPos(placed) {
    var a = rel(scatter), z = size(), pad = 8, best;
    for (var t = 0; t < 80; t++) {
      var x = a.x + pad + Math.random() * (a.w - z - 2 * pad), y = a.y + pad + Math.random() * (a.h - z - 2 * pad);
      best = { x: x, y: y };
      if (placed.every(function (p) { return Math.hypot(p.x - x, p.y - y) > z * 1.05; })) break;
    }
    return best;
  }

  function shuffle() {
    occupant.fill(null); msg.textContent = ''; msg.className = '';
    var placed = [];
    cards.forEach(function (c) { c._slot = null; c.classList.remove('wrong'); var p = randomPos(placed); placed.push(p); setPos(c, p.x, p.y); });
  }

  function slotUnder(c) {
    var r = c.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (var i = 0; i < N; i++) { var s = slots[i].getBoundingClientRect(); if (cx >= s.left && cx <= s.right && cy >= s.top && cy <= s.bottom) return i; }
    return null;
  }
  function clamp(c) { var z = size(); setPos(c, Math.min(Math.max(c._x, 0), stage.clientWidth - z), Math.min(Math.max(c._y, 0), stage.clientHeight - z)); }

  function addDrag(c) {
    var offX, offY, start, startSlot;
    c.addEventListener('pointerdown', function (e) {
      e.preventDefault(); c.setPointerCapture(e.pointerId);
      var r = c.getBoundingClientRect(); offX = e.clientX - r.left; offY = e.clientY - r.top;
      start = { x: c._x, y: c._y }; startSlot = c._slot;
      if (startSlot != null) { occupant[startSlot] = null; c._slot = null; }
      c.classList.remove('wrong'); c.classList.add('dragging'); msg.textContent = ''; msg.className = '';
    });
    c.addEventListener('pointermove', function (e) {
      if (!c.classList.contains('dragging')) return;
      var s = stage.getBoundingClientRect(); setPos(c, e.clientX - s.left - offX, e.clientY - s.top - offY);
      var hit = slotUnder(c); slots.forEach(function (sl, i) { sl.classList.toggle('hover', i === hit); });
    });
    function end() {
      if (!c.classList.contains('dragging')) return;
      c.classList.remove('dragging'); slots.forEach(function (sl) { sl.classList.remove('hover'); });
      var hit = slotUnder(c);
      if (hit != null) {
        var other = occupant[hit];
        if (other && other !== c) {
          if (startSlot != null) placeInSlot(other, startSlot);
          else { other._slot = null; snapTo(other, start.x, start.y); }
        }
        placeInSlot(c, hit); check();
      } else clamp(c);
    }
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  }

  function check() {
    if (occupant.some(function (c) { return !c; })) return;
    var order = occupant.map(function (c) { return +c.dataset.count; });
    var asc = order.every(function (v, i) { return v === i + 1; });
    var desc = ALLOW_DESCENDING && order.every(function (v, i) { return v === N - i; });
    if (asc || desc) return win(asc);
    occupant.forEach(function (c, i) { if (+c.dataset.count !== i + 1) { c.classList.remove('wrong'); void c.offsetWidth; c.classList.add('wrong'); } });
  }

  function win(asc) {
    var list = ITEMS.map(function (it, i) { return (i + 1) + ' ' + (i === 0 ? it[1] : it[2]); });
    $('cop-successText').textContent = 'You arranged them perfectly: ' + (asc ? list : list.reverse()).join(', ') + '.';
    try { localStorage.setItem(UNLOCK_KEY, '1'); } catch (e) {}
    $('cop-skip').classList.add('show');
    overlay.classList.add('show');
    var bits = ['🎉', '✨', '⭐', '🎊', '💫'];
    for (var i = 0; i < 40; i++) {
      var s = document.createElement('span'); s.className = 'cop-confetti'; s.textContent = bits[i % bits.length];
      s.style.left = Math.random() * 100 + 'vw'; s.style.animationDuration = 1.8 + Math.random() * 1.8 + 's'; s.style.animationDelay = Math.random() * .6 + 's';
      document.body.appendChild(s); (function (el) { setTimeout(function () { el.remove(); }, 4500); })(s);
    }
  }

  $('cop-enter').href = NEXT_URL;
  $('cop-skip').href = NEXT_URL;
  try { if (localStorage.getItem(UNLOCK_KEY) === '1') $('cop-skip').classList.add('show'); } catch (e) {}
  $('cop-shuffle').onclick = shuffle;
  $('cop-again').onclick = function () { overlay.classList.remove('show'); shuffle(); };
  window.addEventListener('resize', function () {
    occupant.forEach(function (c, i) { if (c) { var p = slotPos(i); setPos(c, p.x, p.y); } });
    cards.forEach(function (c) { if (c._slot == null) clamp(c); });
  });
  window.addEventListener('load', shuffle);
  shuffle();
})();
