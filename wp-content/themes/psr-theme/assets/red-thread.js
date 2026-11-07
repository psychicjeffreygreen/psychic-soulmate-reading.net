/* Red Thread Loom: п'ять вузлів на червоній нитці, вибір голосу, потокова відповідь Worker. Без залежностей. */
(function () {
  'use strict';
  var root = document.getElementById('rt-app');
  var cfgEl = document.getElementById('rt-config');
  if (!root || !cfgEl) return;
  var cfg = JSON.parse(cfgEl.textContent);
  var READERS = cfg.readers;

  var KNOTS = [
    { key: 'pace', label: 'Pace', q: 'How should love move?', hint: 'Pick the rhythm you secretly hope for.',
      opts: [['slow_burn', 'A slow burn', 'Deepens over many conversations'], ['spark', 'An instant spark', 'Chemistry you can feel at once'],
             ['steady', 'Steady and sure', 'Consistent, dependable attention'], ['playful', 'Light and playful', 'Laughter and banter first']] },
    { key: 'presence', label: 'Presence', q: 'How does this person carry themselves?', hint: 'Think of how they enter a room.',
      opts: [['quiet', 'Quiet and watchful', 'Listens more than they speak'], ['warm', 'Warm and open', 'Puts strangers at ease'],
             ['grounded', 'Calm and capable', 'Steady when plans go wrong'], ['curious', 'Curious and restless', 'Always learning, always exploring']] },
    { key: 'ground', label: 'Shared', q: 'What do the two of you share?', hint: 'Pick one or two.', multi: 2,
      opts: [['values', 'Shared values', 'You want the same big things'], ['humour', 'The same humour', 'You laugh at the same moments'],
             ['creative', 'Creative pursuits', 'Making, music, words or art'], ['outdoors', 'Travel and outdoors', 'Maps, trails and open skies'],
             ['home', 'Home and food', 'Rituals, cooking, family'], ['growth', 'Growth and learning', 'Curiosity about becoming more']] },
    { key: 'crossing', label: 'Crossing', q: 'Where might your paths cross?', hint: 'Choose the setting that feels most natural.',
      opts: [['friends', 'Through friends', 'A shared circle or a dinner'], ['work', 'Work or study', 'A project, a class, a team'],
             ['travel', 'On a trip', 'Somewhere unfamiliar'], ['routine', 'Daily routine', 'A cafe, gym or commute'],
             ['community', 'A club or cause', 'Classes, volunteering, events'], ['online', 'Online first', 'Words before faces']] },
    { key: 'season', label: 'Season', q: 'What season of life are you in?', hint: 'Be honest, there is no wrong answer.',
      opts: [['opening', 'Opening again', 'Heart cracking open after a quiet stretch'], ['healing', 'Healing', 'Letting a breakup finish hurting'],
             ['rebuilding', 'Rebuilding', 'Life and confidence coming back'], ['ready', 'Ready and clear', 'You know what you want'],
             ['unsure', 'Unsure about love', 'Not sure it is the priority']] }
  ];
  var TIE = KNOTS.length; // індекс останньої станції «зав'язати»
  var STEP_LABELS = KNOTS.map(function (k) { return k.label; }).concat(['Tie']);
  var TOWARD = [['him', 'A man'], ['her', 'A woman'], ['them', 'Someone, gender open']];
  var TITLES = { PORTRAIT: 'The one at the other end', MEETING: 'Where your threads could cross', SIGNS: 'Signs to watch for', BRING: 'What you bring to the knot' };

  var qs = new URLSearchParams(location.search);
  var voice0 = qs.get('voice');
  var state = {
    step: 0,
    picks: { pace: null, presence: null, ground: [], crossing: null, season: null },
    toward: 'him',
    voice: READERS.some(function (r) { return r.slug === voice0; }) ? voice0 : READERS[0].slug,
    wish: '',
    phase: 'loom', // loom | writing | done | error
    text: '', cut: false, error: '', tweak: 'none'
  };
  var controller = null;
  var local = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  var ENDPOINT = (local ? 'http://127.0.0.1:8874' : '') + ((window.PSR_AI && window.PSR_AI.endpoint) || '/api/red-thread/');

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function reader(slug) { return READERS.filter(function (r) { return r.slug === slug; })[0]; }
  function answered(i) {
    if (i >= KNOTS.length) return state.phase === 'writing' || state.phase === 'done';
    var v = state.picks[KNOTS[i].key];
    return Array.isArray(v) ? v.length > 0 : !!v;
  }
  function allKnots() { for (var i = 0; i < KNOTS.length; i++) if (!answered(i)) return false; return true; }
  function optLabel(k, val) { var o = k.opts.filter(function (x) { return x[0] === val; })[0]; return o ? o[1] : val; }

  /* ---------- нитка ---------- */
  var N = STEP_LABELS.length;
  var NX = [], NY = [];
  for (var i = 0; i < N; i++) { NX.push(8 + i * (84 / (N - 1))); NY.push(50 + 24 * Math.sin(i * 1.35 + 0.4)); }
  var PTS = [{ x: 0, y: 56 }].concat(NX.map(function (x, i) { return { x: x * 10, y: NY[i] * 1.4 }; })).concat([{ x: 1000, y: 62 }]);
  function seg(a, b, i) {
    var p0 = PTS[Math.max(i - 1, 0)], p1 = PTS[i], p2 = PTS[i + 1], p3 = PTS[Math.min(i + 2, PTS.length - 1)];
    var c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    var c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    return 'M' + p1.x + ',' + p1.y + ' C' + c1.x + ',' + c1.y + ' ' + c2.x + ',' + c2.y + ' ' + p2.x + ',' + p2.y;
  }
  var SEGS = [];
  for (var s = 0; s < PTS.length - 1; s++) SEGS.push(seg(PTS[s], PTS[s + 1], s));

  function buildLoom() {
    var under = SEGS.map(function (d) { return '<path class="rt-under" d="' + d + '"/>'; }).join('');
    var over = SEGS.map(function (d) { return '<path class="rt-over" d="' + d + '"/>'; }).join('');
    var nodes = STEP_LABELS.map(function (l, i) {
      return '<button type="button" class="rt-node" data-i="' + i + '" style="left:' + NX[i] + '%;top:' + NY[i] + '%"><span class="rt-pearl" aria-hidden="true"></span><span class="rt-nl">' + esc(l) + '</span></button>';
    }).join('');
    return '<div class="rt-thread"><svg viewBox="0 0 1000 140" preserveAspectRatio="none" aria-hidden="true">' + under + over + '</svg>' + nodes + '</div>';
  }

  function updateLoom() {
    var loom = root.querySelector('.rt-thread');
    if (!loom) return;
    loom.classList.toggle('is-writing', state.phase === 'writing');
    var overs = loom.querySelectorAll('.rt-over');
    for (var j = 0; j < overs.length; j++) {
      var red;
      if (j === 0) red = true;
      else if (j === overs.length - 1) red = state.phase === 'writing' || state.phase === 'done';
      else red = answered(j - 1);
      var len = overs[j].getTotalLength ? overs[j].getTotalLength() : 400;
      overs[j].style.strokeDasharray = len;
      overs[j].style.strokeDashoffset = red ? 0 : len;
    }
    var nodes = loom.querySelectorAll('.rt-node');
    for (var n = 0; n < nodes.length; n++) {
      var done = n < TIE ? answered(n) : (state.phase === 'writing' || state.phase === 'done');
      nodes[n].classList.toggle('is-done', done);
      nodes[n].classList.toggle('is-active', state.phase === 'loom' && n === state.step);
      var locked = n > state.step && !(n <= TIE && allBefore(n));
      nodes[n].disabled = state.phase === 'writing' || locked;
      nodes[n].setAttribute('aria-label', 'Knot ' + (n + 1) + ': ' + STEP_LABELS[n] + (done ? ', tied' : ''));
      if (n === state.step && state.phase === 'loom') nodes[n].setAttribute('aria-current', 'step'); else nodes[n].removeAttribute('aria-current');
    }
  }
  function allBefore(n) { for (var i = 0; i < n; i++) if (!answered(i)) return false; return true; }

  /* ---------- станції ---------- */
  function stationHTML() {
    var k = KNOTS[state.step];
    var cur = state.picks[k.key];
    var opts = k.opts.map(function (o) {
      var on = k.multi ? cur.indexOf(o[0]) >= 0 : cur === o[0];
      return '<button type="button" class="rt-bead' + (on ? ' is-on' : '') + '" data-v="' + o[0] + '" aria-pressed="' + on + '"><span class="rt-bead-dot" aria-hidden="true"></span><span class="rt-bead-t"><strong>' + esc(o[1]) + '</strong><em>' + esc(o[2]) + '</em></span></button>';
    }).join('');
    var back = state.step > 0 ? '<button type="button" class="rt-ghost" data-act="back">&larr; Back</button>' : '<span></span>';
    var next = '';
    if (k.multi || answered(state.step)) next = '<button type="button" class="btn btn-rose rt-next" data-act="next"' + (answered(state.step) ? '' : ' disabled') + '>' + (state.step === KNOTS.length - 1 ? 'To the final knot' : 'Continue') + ' &rarr;</button>';
    return '<div class="rt-station"><p class="rt-step">Knot ' + (state.step + 1) + ' of ' + KNOTS.length + '</p><h2 class="rt-q" tabindex="-1">' + esc(k.q) + '</h2><p class="rt-hint">' + esc(k.hint) + '</p>' +
      '<div class="rt-beads' + (k.multi ? ' is-multi' : '') + '" role="group" aria-label="' + esc(k.q) + '">' + opts + '</div><div class="rt-nav">' + back + next + '</div></div>';
  }

  function tieHTML() {
    var towards = TOWARD.map(function (t) {
      return '<label class="rt-seg' + (state.toward === t[0] ? ' is-on' : '') + '"><input type="radio" name="rt-toward" value="' + t[0] + '"' + (state.toward === t[0] ? ' checked' : '') + '><span>' + esc(t[1]) + '</span></label>';
    }).join('');
    var voices = READERS.map(function (r) {
      return '<label class="rt-voice' + (state.voice === r.slug ? ' is-on' : '') + '"><input type="radio" name="rt-voice" value="' + r.slug + '"' + (state.voice === r.slug ? ' checked' : '') + '>' +
        '<img src="' + esc(r.avatar) + '" alt="" width="56" height="56"><span><strong>' + esc(r.first) + '</strong><em>' + esc(r.style) + '</em></span></label>';
    }).join('');
    var summary = KNOTS.map(function (k, i) {
      var v = state.picks[k.key];
      var t = Array.isArray(v) ? v.map(function (x) { return optLabel(k, x); }).join(' + ') : optLabel(k, v);
      return '<button type="button" class="rt-chip" data-i="' + i + '" title="Change this knot"><span>' + esc(k.label) + '</span>' + esc(t) + '</button>';
    }).join('');
    return '<div class="rt-station rt-tie"><p class="rt-step">The final knot</p><h2 class="rt-q" tabindex="-1">Choose a voice and tie the thread</h2>' +
      '<div class="rt-chips" aria-label="Your knots">' + summary + '</div>' +
      '<fieldset class="rt-fs"><legend>The thread is pulled toward</legend><div class="rt-segs">' + towards + '</div></fieldset>' +
      '<fieldset class="rt-fs"><legend>Whose voice should write it?</legend><div class="rt-voices">' + voices + '</div></fieldset>' +
      '<label class="rt-fs rt-wishl" for="rt-wish"><span class="rt-legend">One more thread <small>(optional)</small></span><textarea id="rt-wish" maxlength="180" rows="2" placeholder="What do you most want to feel with them? No names, please.">' + esc(state.wish) + '</textarea><span class="rt-count" id="rt-count">' + state.wish.length + '/180</span></label>' +
      '<p class="rt-fine">The Loom is an automated AI tool. It borrows a reader&rsquo;s style, makes no predictions and gives no dates. It is not a live session, and nothing here describes a real person.</p>' +
      '<div class="rt-nav"><button type="button" class="rt-ghost" data-act="back">&larr; Back</button><button type="button" class="btn btn-rose rt-go" data-act="tie">Tie the thread &rarr;</button></div></div>';
  }

  /* ---------- відповідь ---------- */
  function parse(text) {
    var out = { TITLE: '', PORTRAIT: '', MEETING: '', SIGNS: '', BRING: '', NOTE: '' }, order = [];
    var re = /\[(TITLE|PORTRAIT|MEETING|SIGNS|BRING|NOTE)\]/g, m, last = null, idx = 0;
    while ((m = re.exec(text))) {
      if (last) out[last] = text.slice(idx, m.index);
      last = m[1]; idx = re.lastIndex; order.push(last);
    }
    if (last) out[last] = text.slice(idx);
    for (var k in out) out[k] = out[k].replace(/^\s+|\s+$/g, '');
    out._order = order;
    return out;
  }
  function paras(t) { return t.split(/\n\s*\n/).map(function (p) { return '<p>' + esc(p.replace(/\s*\n\s*/g, ' ')) + '</p>'; }).join(''); }
  function signs(t) {
    var items = t.split('\n').map(function (l) { return l.replace(/^\s*[-•*]\s*/, '').trim(); }).filter(Boolean);
    return '<ul>' + items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
  }

  function letterHTML() {
    var p = parse(state.text), r = reader(state.voice), done = state.phase === 'done';
    var body = '';
    if (p._order.indexOf('NOTE') >= 0) {
      body = '<section class="rt-sec"><span class="rt-knot"></span><h3>A note from ' + esc(r.first) + '</h3>' + paras(p.NOTE) + '</section>';
    } else {
      ['PORTRAIT', 'MEETING', 'SIGNS', 'BRING'].forEach(function (key) {
        if (p._order.indexOf(key) < 0) return;
        body += '<section class="rt-sec"><span class="rt-knot"></span><h3>' + TITLES[key] + '</h3>' + (key === 'SIGNS' ? signs(p[key]) : paras(p[key])) + '</section>';
      });
    }
    if (!body) body = '<section class="rt-sec"><span class="rt-knot"></span><p class="rt-wait">Tying your thread&hellip;</p></section>';
    var title = p.TITLE ? esc(p.TITLE.split('\n')[0]) : (done ? 'Your thread letter' : 'Tying the knots&hellip;');
    var actions = '';
    if (done) {
      actions = '<div class="rt-actions" role="group" aria-label="Adjust your letter">' +
        '<button type="button" class="rt-pill" data-tw="fresh">Write it again</button><button type="button" class="rt-pill" data-tw="gentler">Gentler</button>' +
        '<button type="button" class="rt-pill" data-tw="vivid">More vivid</button><button type="button" class="rt-pill" data-tw="shorter">Shorter</button>' +
        '<button type="button" class="rt-pill" data-act="retie">Retie a knot</button><button type="button" class="rt-pill" data-act="copy">Copy letter</button></div>';
      if (state.cut) actions = '<p class="rt-cut">The letter was cut short. Try again for a full version.</p>' + actions;
    }
    return '<article class="rt-letter' + (done ? ' is-done' : '') + '" aria-live="polite"><header class="rt-lhead"><span class="rt-by"><img src="' + esc(r.avatar) + '" alt="" width="40" height="40">Written in ' + esc(r.first) + '&rsquo;s style &middot; AI reflection, not a live reading</span><h2 class="rt-title" tabindex="-1">' + title + '</h2></header>' +
      '<div class="rt-lbody">' + body + '</div>' + actions + '<p class="rt-fine rt-fine-end">For entertainment and reflection. No dates, no predictions, no real person described.</p></article>';
  }

  function errorHTML() {
    return '<div class="rt-error" role="alert"><p>' + esc(state.error) + '</p><div class="rt-nav"><button type="button" class="rt-ghost" data-act="back">&larr; Back</button><button type="button" class="btn btn-rose" data-act="tie">Try again</button></div></div>';
  }

  /* ---------- відмальовування ---------- */
  var panel;
  function mount() {
    root.innerHTML = buildLoom() + '<div class="rt-panel"></div>';
    panel = root.querySelector('.rt-panel');
    updateLoom();
    render(false);
  }
  function render(focus) {
    if (state.phase === 'loom') panel.innerHTML = state.step < TIE ? stationHTML() : tieHTML();
    else if (state.phase === 'error') panel.innerHTML = errorHTML();
    else panel.innerHTML = letterHTML();
    updateLoom();
    if (focus) { var f = panel.querySelector('.rt-q, .rt-title'); if (f) f.focus({ preventScroll: true }); }
  }
  function patchLetter() {
    var a = panel.querySelector('.rt-letter');
    if (!a) { render(false); return; }
    var tmp = document.createElement('div'); tmp.innerHTML = letterHTML();
    var n = tmp.firstChild;
    a.querySelector('.rt-lbody').innerHTML = n.querySelector('.rt-lbody').innerHTML;
    a.querySelector('.rt-title').innerHTML = n.querySelector('.rt-title').innerHTML;
  }

  function go(step, focus) { state.step = step; state.phase = 'loom'; render(focus !== false); }

  function payload() {
    var d = { advisor: state.voice, toward: state.toward, pace: state.picks.pace, presence: state.picks.presence, ground: state.picks.ground.slice(), crossing: state.picks.crossing, season: state.picks.season, tweak: state.tweak };
    var w = state.wish.replace(/\s+/g, ' ').trim();
    if (w) d.wish = w;
    return d;
  }

  function incomplete() {
    var p = parse(state.text);
    if (p._order.indexOf('NOTE') >= 0) return false;
    return p._order.indexOf('BRING') < 0 || p.BRING.length < 40 || p._order.indexOf('SIGNS') < 0;
  }

  function generate(tweak, retried) {
    if (controller) controller.abort();
    controller = new AbortController();
    state.tweak = tweak || 'none';
    state.phase = 'writing'; state.text = ''; state.cut = false; state.error = '';
    render(false);
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var gotAny = false;
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()), signal: controller.signal }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || 'The Loom is unavailable right now. Please try again in a moment.'); });
      }
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          buf += dec.decode(r.value, { stream: true });
          var lines = buf.split('\n'); buf = lines.pop();
          lines.forEach(function (line) {
            line = line.trim();
            if (line.indexOf('data:') !== 0) return;
            var d = line.slice(5).trim();
            if (d === '[DONE]') return;
            try {
              var j = JSON.parse(d);
              if (j.t) { state.text += j.t; gotAny = true; }
              if (j.cut) state.cut = true;
            } catch (e) { /* неповний рядок */ }
          });
          patchLetter();
          return pump();
        });
      }
      return pump();
    }).then(function () {
      if (!gotAny) throw new Error('The Loom returned nothing. Please try again.');
      if (incomplete() && !retried) { generate(tweak, true); return; } // обрив потоку: одна автоматична повторна спроба
      if (incomplete()) state.cut = true;
      state.phase = 'done'; render(false); updateLoom();
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return;
      if (gotAny && !retried) { generate(tweak, true); return; }
      if (gotAny && state.text.length > 80) { state.phase = 'done'; state.cut = true; render(false); return; }
      state.phase = 'error'; state.error = (e && e.message) || 'Something went wrong. Please try again.'; render(false);
    });
  }

  /* ---------- події ---------- */
  root.addEventListener('click', function (ev) {
    var t = ev.target.closest('button');
    if (!t || !root.contains(t)) return;
    if (t.classList.contains('rt-node')) { var i = +t.dataset.i; if (state.phase === 'loom' || state.phase === 'done') go(i); return; }
    if (t.classList.contains('rt-chip')) { go(+t.dataset.i); return; }
    if (t.classList.contains('rt-bead')) {
      var k = KNOTS[state.step], v = t.dataset.v;
      if (k.multi) {
        var arr = state.picks[k.key], at = arr.indexOf(v);
        if (at >= 0) arr.splice(at, 1); else { if (arr.length >= k.multi) arr.shift(); arr.push(v); }
        render(false); updateLoom();
      } else {
        state.picks[k.key] = v; updateLoom();
        var beads = panel.querySelectorAll('.rt-bead');
        for (var b = 0; b < beads.length; b++) { var on = beads[b] === t; beads[b].classList.toggle('is-on', on); beads[b].setAttribute('aria-pressed', on); }
        var step = state.step;
        setTimeout(function () { if (state.phase === 'loom' && state.step === step) go(step + 1); }, 420);
      }
      return;
    }
    var act = t.dataset.act, tw = t.dataset.tw;
    if (tw) { generate(tw); return; }
    if (act === 'next') go(state.step + 1);
    else if (act === 'back') { if (state.phase === 'error') go(TIE); else go(Math.max(0, state.step - 1)); }
    else if (act === 'tie') { if (allKnots()) generate('none'); }
    else if (act === 'retie') { go(0); }
    else if (act === 'copy') {
      var p = parse(state.text);
      var txt = [p.TITLE, p.PORTRAIT, p.MEETING, p.SIGNS, p.BRING].filter(Boolean).join('\n\n') + '\n\n(AI-written reflection for entertainment, psychic-soulmate-reading.com)';
      var done = function () { t.textContent = 'Copied'; setTimeout(function () { t.textContent = 'Copy letter'; }, 1600); };
      try { navigator.clipboard.writeText(txt).then(done, function () { }); } catch (e) { /* буфер недоступний */ }
    }
  });
  root.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.name === 'rt-toward') state.toward = t.value;
    if (t.name === 'rt-voice') state.voice = t.value;
    if (t.name === 'rt-toward' || t.name === 'rt-voice') {
      var group = panel.querySelectorAll('input[name="' + t.name + '"]');
      for (var i = 0; i < group.length; i++) group[i].parentNode.classList.toggle('is-on', group[i].checked);
    }
  });
  root.addEventListener('input', function (ev) {
    if (ev.target.id === 'rt-wish') {
      state.wish = ev.target.value;
      var c = document.getElementById('rt-count'); if (c) c.textContent = state.wish.length + '/180';
    }
  });

  mount();
})();
