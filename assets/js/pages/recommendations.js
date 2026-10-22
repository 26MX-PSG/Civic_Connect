/* Personalised recommendations */
(function () {
  var U = CC.ui, T = CC.i18n.t, S = CC.store;
  var u = U.requireLogin(); if (!u) return;
  var root = U.$('#rec-root');
  root.innerHTML = '<div class="row row-cols-1 row-cols-md-2 g-3">' + U.skeletonCards(4) + '</div>';
  CC.api('profile', u.id).then(function (p) {
    if (!p) { root.innerHTML = '<div class="panel">' + U.empty('person-vcard', T('rec.noProfile', 'Tell us about yourself first'), T('rec.noProfileT', 'Complete a short profile and we’ll show schemes whose basic criteria match your details.'), '<a class="btn btn-primary" href="profile.html">' + U.esc(T('dash.completeBtn', 'Complete profile')) + '</a>') + '</div>'; return; }
    var recs = CC.match.recommend(p);
    var full = recs.filter(function (r) { return r.result.status === 'MATCH'; }), part = recs.filter(function (r) { return r.result.status === 'PARTIAL'; });
    if (!recs.length) { root.innerHTML = '<div class="panel">' + U.empty('search', T('rec.none', 'No matches yet'), T('rec.noneT', 'Try completing more of your profile, or browse all 15 schemes.'), '<div class="d-flex gap-2 justify-content-center flex-wrap"><a class="btn btn-outline-primary" href="profile.html">' + U.esc(T('rec.edit', 'Edit profile')) + '</a><a class="btn btn-primary" href="schemes.html">' + U.esc(T('home.browse', 'Browse All 15')) + '</a></div>') + '</div>'; return; }
    function group(list, title, icon, sub) {
      if (!list.length) return '';
      return '<section class="mb-5"><h2 class="h3 d-flex align-items-center gap-2"><i class="bi bi-' + icon + '" aria-hidden="true"></i>' + U.esc(title) + ' <span class="badge-cc b-cat">' + list.length + '</span></h2><p class="text-muted small">' + U.esc(sub) + '</p><div class="row row-cols-1 row-cols-md-2 g-3">' +
        list.map(function (r) { return '<div class="col">' + U.schemeCard(r.scheme, { result: r.result }) + '</div>'; }).join('') + '</div></section>';
    }
    root.innerHTML = group(full, T('match.basic', 'Basic Criteria Match'), 'check-circle', T('rec.fullSub', 'Your profile meets the basic criteria we have recorded for these schemes.')) +
      group(part, T('match.partial', 'Partial match – complete your profile'), 'question-circle', T('rec.partSub', 'Some details these schemes need are missing from your profile. Add them to get a clearer result.'));
    U.bindSave(root);
  });
})();
