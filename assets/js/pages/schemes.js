/* Discover: search + filters + results + no-results state */
(function () {
  var U = CC.ui, T = CC.i18n.t, S = CC.store;
  var u = S.currentUser(), prof = u ? S.profile(u.id) : null;
  var st = { q: U.param('q') || '', cats: (U.param('category') || '').split(',').filter(Boolean), type: U.param('type') || '', mine: U.param('mine') === '1', sort: U.param('sort') || 'rel' };
  var allCats = S.categories();
  var total = S.schemes({ includeInactive: true }).length;

  function drawFilters(root, pfx) {
    root.querySelector('[data-f=cats]').innerHTML = allCats.map(function (c) {
      return '<div class="form-check"><input class="form-check-input" type="checkbox" id="' + pfx + 'c-' + c.slug + '" value="' + c.slug + '" data-cat><label class="form-check-label" for="' + pfx + 'c-' + c.slug + '">' + U.esc(U.cName(c)) + ' <span class="text-muted small">(' + c.scheme_count + ')</span></label></div>';
    }).join('');
    root.querySelector('[data-f=level]').innerHTML = [['', T('filter.all', 'All')], ['CENTRAL', U.label('CENTRAL')], ['STATE', U.label('STATE')]].map(function (o) {
      return '<input type="radio" name="' + pfx + 'lvl" id="' + pfx + 'l-' + (o[0] || 'all') + '" value="' + o[0] + '" data-lvl><label for="' + pfx + 'l-' + (o[0] || 'all') + '">' + U.esc(o[1]) + '</label>';
    }).join('');
    var mw = root.querySelector('[data-f=mine-wrap]'); mw.hidden = !prof;
    var mi = root.querySelector('[data-f=mine]'); mi.id = pfx + 'mine'; mi.nextElementSibling.setAttribute('for', pfx + 'mine');
    root.addEventListener('change', function () {
      st.cats = [].map.call(root.querySelectorAll('[data-cat]:checked'), function (x) { return x.value; });
      var l = root.querySelector('[data-lvl]:checked'); st.type = l ? l.value : '';
      st.mine = mi.checked; sync(); run(false);
    });
  }
  function sync() {
    ['d-', 'm-'].forEach(function (pfx) {
      U.$$('[data-cat]').forEach(function (x) { x.checked = st.cats.indexOf(x.value) > -1; });
      U.$$('[data-lvl]').forEach(function (x) { x.checked = x.value === st.type; });
      U.$$('[data-f=mine]').forEach(function (x) { x.checked = st.mine; });
    });
    var n = st.cats.length + (st.type ? 1 : 0) + (st.mine ? 1 : 0);
    U.$('#f-count').textContent = n ? '(' + n + ')' : '';
    U.$('#q').value = st.q; U.$('#sort').value = st.sort;
  }
  function url() {
    var p = new URLSearchParams(); if (st.q) p.set('q', st.q); if (st.cats.length) p.set('category', st.cats.join(',')); if (st.type) p.set('type', st.type); if (st.mine) p.set('mine', '1'); if (st.sort !== 'rel') p.set('sort', st.sort);
    history.replaceState(null, '', 'schemes.html' + (p.toString() ? '?' + p : ''));
  }
  function chips() {
    var c = [];
    if (st.q) c.push(['q', '“' + st.q + '”']);
    st.cats.forEach(function (x) { c.push(['cat:' + x, U.cName(S.category(x))]); });
    if (st.type) c.push(['type', U.label(st.type)]);
    if (st.mine) c.push(['mine', T('filter.mine', 'Show only my matches')]);
    U.$('#active-chips').innerHTML = c.map(function (x) { return '<button type="button" class="chip is-active" data-rm="' + U.esc(x[0]) + '" aria-label="' + U.esc(T('filter.remove', 'Remove filter') + ': ' + x[1]) + '">' + U.esc(x[1]) + ' <i class="bi bi-x-lg" aria-hidden="true"></i></button>'; }).join('') +
      (c.length ? '<button type="button" class="btn btn-sm btn-ghost" id="clear-all">' + U.esc(T('filter.clear', 'Clear all')) + '</button>' : '');
    U.$$('[data-rm]').forEach(function (b) { b.addEventListener('click', function () {
      var k = b.getAttribute('data-rm'); if (k === 'q') st.q = ''; else if (k === 'type') st.type = ''; else if (k === 'mine') st.mine = false; else st.cats = st.cats.filter(function (x) { return 'cat:' + x !== k; });
      sync(); run(false);
    }); });
    var ca = U.$('#clear-all'); if (ca) ca.addEventListener('click', clearAll);
  }
  function clearAll() { st = { q: '', cats: [], type: '', mine: false, sort: st.sort }; sync(); run(false); }
  var res = U.$('#results');
  function run(log) {
    url(); chips();
    res.innerHTML = U.skeletonCards(4); U.$('#res-count').textContent = T('common.loading', 'Loading…');
    CC.api('schemes', { keyword: st.q, category: st.cats, level: st.type, noLog: !log, includeInactive: true }).then(function (list) {
      var results = {};
      if (prof) list.forEach(function (s) { results[s.id] = CC.match.evaluate(s, prof); });
      if (st.mine && prof) list = list.filter(function (s) { return results[s.id].status !== 'NONE'; });
      if (st.sort === 'az') list = list.slice().sort(function (a, b) { return U.sName(a).localeCompare(U.sName(b)); });
      list = list.filter(function (s) { return s.is_active; }).concat(list.filter(function (s) { return !s.is_active; }));
      U.$('#res-count').textContent = T('disc.showing', 'Showing') + ' ' + list.length + ' ' + T('disc.of', 'of') + ' ' + total + ' ' + T('common.schemes', 'schemes');
      if (!list.length) {
        res.innerHTML = '<div class="col-12"><div class="panel">' + U.empty('search', st.q ? T('disc.noneQ', 'We couldn’t find a matching scheme for') + ' “' + st.q + '”' : T('disc.none', 'No schemes match these filters'),
          T('disc.noneT', 'Check the spelling, remove a filter, or try a simpler word like “farmer” or “scholarship”.'),
          '<div class="d-flex flex-wrap gap-2 justify-content-center"><button class="btn btn-outline-primary" id="nr-clear">' + U.esc(T('filter.clear', 'Clear all')) + '</button><button class="btn btn-primary" id="nr-all">' + U.esc(T('home.browse', 'Browse All 15')) + '</button>' +
          (st.q ? '<button class="btn btn-accent" data-open-bot data-q="' + U.esc(st.q) + '"><i class="bi bi-chat-dots" aria-hidden="true"></i>' + U.esc(T('disc.askBot', 'Ask the assistant')) + '</button>' : '') + '</div>' +
          (st.q && log ? '<p class="small text-muted mt-3 mb-0"><i class="bi bi-journal-plus" aria-hidden="true"></i> ' + U.esc(T('disc.logged', 'We’ve recorded this search so our team can review it.')) + '</p>' : '')) + '</div></div>';
        U.$('#nr-clear').onclick = clearAll; U.$('#nr-all').onclick = clearAll;
        return;
      }
      res.innerHTML = list.map(function (s) { return '<div class="col">' + U.schemeCard(s, prof && results[s.id].status !== 'NONE' ? { result: { status: results[s.id].status, reasons: [], missing: [] } } : {}) + '</div>'; }).join('');
      U.bindSave(res);
    }).catch(function () { res.innerHTML = '<div class="col-12">' + U.errorState('retry') + '</div>'; U.$('#retry').onclick = function () { run(false); }; });
  }
  drawFilters(U.$('#filters-desktop'), 'd-'); drawFilters(U.$('#filters-mobile'), 'm-');
  sync(); run(true);
  var tmr;
  U.$('#q').addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(function () { st.q = U.$('#q').value.trim(); run(false); }, 350); });
  U.$('#search-form').addEventListener('submit', function (e) { e.preventDefault(); clearTimeout(tmr); st.q = U.$('#q').value.trim(); run(true); });
  U.$('#sort').addEventListener('change', function () { st.sort = this.value; run(false); });
  U.$('#clear-mobile').addEventListener('click', clearAll);
})();
