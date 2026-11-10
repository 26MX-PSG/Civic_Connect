/* Citizen dashboard */
(function () {
  var U = CC.ui, T = CC.i18n.t, S = CC.store;
  var u = U.requireLogin(); if (!u) return;
  var p = S.profile(u.id);
  U.$('#greet').textContent = T('dash.hello', 'Vanakkam') + ', ' + u.name.split(' ')[0];
  U.$('#today').textContent = U.date(new Date().toISOString().slice(0, 10));
  var pc = CC.match.completion(p);
  if (pc < 100) U.$('#completion').innerHTML = '<div class="panel mb-4 d-flex flex-wrap gap-3 align-items-center"><div class="ring" style="--p:' + pc + '"><span>' + pc + '%</span></div><div class="flex-grow-1"><h2 class="h5 mb-1">' + U.esc(T('dash.completeH', 'Complete your profile for better matches')) + '</h2><p class="text-muted small mb-0">' + U.esc(T('dash.completeP', 'Some schemes show “Partial match” because a few details are missing.')) + '</p></div><a class="btn btn-primary" href="profile.html">' + U.esc(T('dash.completeBtn', 'Complete profile')) + '</a></div>';
  var m = U.$('#dash-matches');
  m.innerHTML = U.skeletonCards(2);
  CC.api('profile', u.id).then(function (pr) {
    var recs = pr ? CC.match.recommend(pr).sort(function (a, b) { return a.result.status === b.result.status ? 0 : a.result.status === 'MATCH' ? -1 : 1; }) : [];
    m.innerHTML = recs.length ? recs.slice(0, 4).map(function (r) { return '<div class="col">' + U.schemeCard(r.scheme, { result: { status: r.result.status, reasons: [], missing: [] } }) + '</div>'; }).join('')
      : '<div class="col-12">' + U.empty('stars', T('dash.noMatches', 'No matches yet'), T('dash.noMatchesT', 'Complete your profile to see schemes that match your details.'), '<a class="btn btn-primary" href="profile.html">' + U.esc(T('dash.completeBtn', 'Complete profile')) + '</a>') + '</div>';
    U.bindSave(m);
  });
  var saved = S.saved(u.id).length;
  U.$('#tiles').innerHTML = [['bookmark', 'saved.html', T('nav.saved', 'Saved'), saved + ' ' + T('common.schemes', 'schemes')], ['grid', 'categories.html', T('dash.browseCats', 'Browse categories'), '10 ' + T('dash.cats', 'categories')], ['question-circle', 'help.html', T('nav.help', 'Help'), T('dash.helpT', 'FAQs & assistant')]]
    .map(function (t) { return '<div class="col-sm-4"><a class="card tile" href="' + t[1] + '"><span class="cat-icon"><i class="bi bi-' + t[0] + '" aria-hidden="true"></i></span><span><span class="fw-semibold d-block">' + U.esc(t[2]) + '</span><span class="small text-muted">' + U.esc(t[3]) + '</span></span></a></div>'; }).join('');
  function renderN() {
    var ns = S.notifications(u.id).slice(0, 5);
    U.$('#notifs').innerHTML = ns.length ? ns.map(function (n) {
      var href = n.scheme_id ? 'scheme.html?slug=' + S.scheme(n.scheme_id).slug : '#';
      return '<div class="notif' + (n.is_read ? ' read' : '') + '"><span class="dot" aria-hidden="true"></span><div><a href="' + href + '" data-n="' + n.id + '" class="fw-semibold text-decoration-none">' + U.esc(CC.i18n.lang === 'ta' && n.title_ta ? n.title_ta : n.title_en) + '</a>' + (n.is_read ? '' : ' <span class="visually-hidden">(' + U.esc(T('dash.unread', 'unread')) + ')</span>') + '<div class="small text-muted">' + U.esc(U.date(n.created_at)) + '</div></div></div>';
    }).join('') : U.empty('bell', T('dash.noNotifs', 'No notifications'), T('dash.noNotifsT', 'We’ll let you know when a saved scheme changes.'));
    U.$$('[data-n]').forEach(function (a) { a.addEventListener('click', function () { S.markRead(Number(a.getAttribute('data-n'))); }); });
  }
  renderN();
})();
