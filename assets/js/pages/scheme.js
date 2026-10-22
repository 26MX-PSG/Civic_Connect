/* Scheme details — tabs, criteria check, document checklist, scheme assistant, feedback */
(function () {
  var U = CC.ui, T = CC.i18n.t, S = CC.store, ta = CC.i18n.lang === 'ta';
  var root = U.$('#scheme-root');
  var s = S.scheme(U.param('slug') || U.param('id'));
  if (!s) { root.innerHTML = '<div class="container py-5">' + U.empty('journal-x', T('detail.notFound', 'Scheme not found'), T('detail.notFoundT', 'This scheme may have been removed or the link is wrong.'), '<a class="btn btn-primary" href="schemes.html">' + U.esc(T('home.browse', 'Browse All 15')) + '</a>') + '</div>'; return; }
  document.title = U.sName(s) + ' · CivicConnect';
  var u = S.currentUser(), prof = u ? S.profile(u.id) : null, res = prof ? CC.match.evaluate(s, prof) : null;
  var c = S.category(s.category_id), saved = u ? S.isSaved(u.id, s.id) : false;
  var overdue = U.daysSince(s.last_verified_on) > 90;

  function critIcon(r) { return { pass: '<span class="crit-ico pass"><i class="bi bi-check-lg" aria-hidden="true"></i></span>', fail: '<span class="crit-ico fail"><i class="bi bi-dash-lg" aria-hidden="true"></i></span>', unknown: '<span class="crit-ico unknown"><i class="bi bi-question-lg" aria-hidden="true"></i></span>', none: '<span class="crit-ico none"><i class="bi bi-dot" aria-hidden="true"></i></span>' }[r]; }
  function critText(r) { return { pass: T('crit.pass', 'Your profile meets this'), fail: T('crit.fail', 'Your profile does not meet this'), unknown: T('crit.unknown', 'Unknown — add this to your profile') }[r] || ''; }
  var critHtml = '';
  s.criteria.forEach(function (cr, i) {
    if (i > 0 && cr.group !== s.criteria[i - 1].group) critHtml += '<div class="or-divider">' + U.esc(T('crit.or', 'or')) + '</div>';
    var r = res ? res.perCriterion[i].r : 'none';
    critHtml += '<div class="crit-row">' + critIcon(r) + '<div><div class="fw-semibold">' + U.esc(ta && cr.label_ta ? cr.label_ta : cr.label_en) + '</div>' + (res ? '<div class="small text-muted">' + U.esc(critText(r)) + '</div>' : '') + '</div></div>';
  });
  if (s.state) { var sr = res ? res.stateResult : 'none'; critHtml += '<div class="crit-row">' + critIcon(sr) + '<div><div class="fw-semibold">' + U.esc(T('crit.lives', 'Lives in') + ' ' + s.state) + '</div>' + (res ? '<div class="small text-muted">' + U.esc(critText(sr)) + '</div>' : '') + '</div></div>'; }

  var docs = s.documents.map(function (x) { return Object.assign({ mandatory: x.mandatory }, S.doc(x.id)); });
  var ticked = S.checklist(s.id);

  root.innerHTML =
    '<section class="detail-hero"><div class="container">' +
      '<nav aria-label="breadcrumb"><ol class="breadcrumb"><li class="breadcrumb-item"><a href="schemes.html">' + U.esc(T('nav.discover', 'Discover')) + '</a></li><li class="breadcrumb-item"><a href="schemes.html?category=' + c.slug + '">' + U.esc(U.cName(c)) + '</a></li><li class="breadcrumb-item active" aria-current="page">' + U.esc(U.sName(s)) + '</li></ol></nav>' +
      '<div class="row g-4 align-items-center"><div class="col-lg-8">' +
        '<div class="d-flex flex-wrap gap-2 mb-2">' + U.levelBadge(s) + '<span class="badge-cc b-cat">' + U.esc(U.cName(c)) + '</span>' + (res ? U.matchBadge(res.status) : '') + (s.is_verified ? '' : U.demoRibbon()) + '</div>' +
        '<h1 class="mb-2">' + U.esc(U.sName(s)) + '</h1><p class="lead text-muted" style="font-size:1.1rem">' + U.esc(U.sShort(s)) + '</p>' +
        (s.is_active ? '' : '<div class="warn-box mb-3"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i><div><strong>' + U.esc(T('status.noLonger', 'No longer active')) + '.</strong> ' + U.esc(T('detail.inactiveT', 'This scheme is not currently listed as active. Check the official source for the latest status.')) + '</div></div>') +
        '<div class="action-bar sticky-mobile no-print"><button type="button" class="btn btn-outline-primary" id="save-btn" aria-pressed="' + saved + '"></button>' +
          '<button type="button" class="btn btn-primary" id="portal-btn"' + (s.is_active ? '' : ' disabled') + '><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>' + U.esc(T('detail.portal', 'Visit Official Portal')) + '</button></div>' +
      '</div><div class="col-lg-4 d-none d-lg-block">' + U.img('cat', c.slug, '', 'detail-img') + '</div></div>' +
    '</div></section>' +
    '<div class="container mt-4 has-sticky"><div class="row g-4"><div class="col-lg-8">' +
      '<div class="card"><ul class="nav cc-tabs px-2" role="tablist">' +
        [['overview', 'info-circle', T('tab.overview', 'Overview & benefits')], ['criteria', 'list-check', T('tab.criteria', 'Basic criteria')], ['documents', 'file-earmark-text', T('tab.documents', 'Documents')], ['source', 'patch-check', T('tab.source', 'Source')]]
          .map(function (t, i) { return '<li class="nav-item" role="presentation"><button class="nav-link' + (i ? '' : ' active') + '" id="tab-' + t[0] + '" data-bs-toggle="tab" data-bs-target="#p-' + t[0] + '" type="button" role="tab" aria-controls="p-' + t[0] + '" aria-selected="' + !i + '"><i class="bi bi-' + t[1] + '" aria-hidden="true"></i> ' + U.esc(t[2]) + '</button></li>'; }).join('') +
      '</ul><div class="tab-content p-3 p-md-4">' +
        '<div class="tab-pane fade show active" id="p-overview" role="tabpanel" aria-labelledby="tab-overview"><h2 class="h4">' + U.esc(T('detail.whoFor', 'Who it is for')) + '</h2><p>' + U.esc(s.who_en) + '</p><h2 class="h4 mt-4">' + U.esc(T('detail.benefits', 'Benefits')) + '</h2><ul>' + s.benefits_en.map(function (b) { return '<li class="mb-1">' + U.esc(b) + '</li>'; }).join('') + '</ul>' + (ta ? '<p class="small text-muted">(இந்தப் பகுதி தற்போது ஆங்கிலத்தில் மட்டும் உள்ளது)</p>' : '') + '</div>' +
        '<div class="tab-pane fade" id="p-criteria" role="tabpanel" aria-labelledby="tab-criteria"><h2 class="h4">' + U.esc(T('tab.criteria', 'Basic criteria')) + '</h2>' +
          (res ? '<p class="small text-muted">' + U.esc(T('crit.compared', 'Compared with your profile:')) + ' ' + U.matchBadge(res.status) + (res.status === 'NONE' ? '<span class="badge-cc b-cat">' + U.esc(T('crit.noMatch', 'Basic criteria not met')) + '</span>' : '') + '</p>'
               : '<p class="small text-muted">' + (u ? '<a href="profile.html">' + U.esc(T('crit.addProfile', 'Complete your profile')) + '</a> ' + U.esc(T('crit.toCompare', 'to compare your details.')) : '<a href="login.html?next=' + encodeURIComponent('scheme.html?slug=' + s.slug + '#criteria') + '">' + U.esc(T('nav.login', 'Log in')) + '</a> ' + U.esc(T('crit.toCompare', 'to compare your details.'))) + '</p>') +
          critHtml + (res && res.missing.length ? '<a class="btn btn-sm btn-outline-primary mt-3" href="profile.html#f-' + res.missing[0] + '">' + U.esc(T('crit.addMissing', 'Add missing details')) + '</a>' : '') + '</div>' +
        '<div class="tab-pane fade" id="p-documents" role="tabpanel" aria-labelledby="tab-documents"><div id="print-area"><h2 class="h4">' + U.esc(T('docs.h', 'Document checklist')) + '</h2><p class="small text-muted">' + U.esc(T('docs.p', 'Tick what you already have. This is saved only in your browser — nothing is uploaded.')) + '</p>' +
          '<div class="d-flex justify-content-between small fw-semibold mb-1"><span id="doc-prog-label"></span></div><div class="progress mb-3" role="progressbar" aria-label="' + U.esc(T('docs.progress', 'Documents ready')) + '" aria-valuemin="0" aria-valuemax="' + docs.length + '" id="doc-prog"><div class="progress-bar"></div></div>' +
          docs.map(function (d) { return '<div class="doc-row" id="doc-' + d.id + '"><input class="form-check-input mt-1" type="checkbox" id="ck-' + d.id + '" value="' + d.id + '"' + (ticked.indexOf(d.id) > -1 ? ' checked' : '') + '><div class="flex-grow-1"><label for="ck-' + d.id + '">' + U.esc(U.dName(d)) + '</label> ' + (d.mandatory ? '<span class="badge-cc b-cat">' + U.esc(T('docs.required', 'Required')) + '</span>' : '<span class="badge-cc b-state">' + U.esc(T('docs.optional', 'If applicable')) + '</span>') +
            '<div class="where"><i class="bi bi-geo-alt" aria-hidden="true"></i> <strong>' + U.esc(T('docs.where', 'Where to get it')) + ':</strong> ' + U.esc(ta && d.where_ta ? d.where_ta : d.where_en) + (d.link ? ' <a class="no-print" href="' + d.link + '" target="_blank" rel="noopener">' + U.esc(d.link_label) + ' <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a>' : '') + '</div></div></div>'; }).join('') +
          '</div><button class="btn btn-outline-primary mt-3 no-print" id="print-btn"><i class="bi bi-printer" aria-hidden="true"></i>' + U.esc(T('docs.print', 'Print checklist')) + '</button></div>' +
        '<div class="tab-pane fade" id="p-source" role="tabpanel" aria-labelledby="tab-source"><h2 class="h4">' + U.esc(T('tab.source', 'Source')) + '</h2><dl class="row mb-0">' +
          '<dt class="col-sm-4">' + U.esc(T('detail.dept', 'Department')) + '</dt><dd class="col-sm-8">' + U.esc(s.source_name) + '</dd>' +
          '<dt class="col-sm-4">' + U.esc(T('detail.sourceLink', 'Source link')) + '</dt><dd class="col-sm-8"><a href="' + s.source_url + '" target="_blank" rel="noopener">' + U.esc(s.source_url.replace(/^https?:\/\//, '')) + ' <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a></dd>' +
          '<dt class="col-sm-4">' + U.esc(T('bot.lastVerified', 'Last verified')) + '</dt><dd class="col-sm-8">' + U.esc(U.date(s.last_verified_on)) + (overdue ? ' <span class="badge-cc b-overdue">' + U.esc(T('status.overdue', 'Check overdue')) + '</span>' : '') + '</dd>' +
          '<dt class="col-sm-4">' + U.esc(T('detail.status', 'Verification')) + '</dt><dd class="col-sm-8">' + (s.is_verified ? U.esc(T('detail.verifiedOk', 'Checked against the official source')) : U.demoRibbon()) + '</dd></dl></div>' +
      '</div></div>' +
      '<div class="disclaimer-box mt-3"><i class="bi bi-info-circle" aria-hidden="true"></i><div>' + U.esc(T('disclaimer.text', 'This information is for guidance only and is not an official eligibility decision. Please confirm on the official portal.')) + '</div></div>' +
      '<section class="panel mt-3 no-print" id="feedback" aria-labelledby="fb-h"></section>' +
    '</div><div class="col-lg-4"><div class="position-sticky d-grid gap-3" style="top:90px">' +
      '<section class="card bot-inline" aria-labelledby="sb-h" style="height:600px"><header class="bot-head"><div class="bot-avatar" aria-hidden="true"><i class="bi bi-chat-square-text"></i></div><div><h2 id="sb-h">' + U.esc(T('bot.schemeTitle', 'Ask about this scheme')) + '</h2><p>' + U.esc(T('bot.schemeSub', 'Answers only from this scheme’s page & documents')) + '</p></div></header><div class="bot-body" id="scheme-bot"></div></section>' +
    '</div></div></div></div>';

  document.body.classList.add('has-sticky-bar');
  // save
  var sb = U.$('#save-btn');
  function drawSave() { var on = sb.getAttribute('aria-pressed') === 'true'; sb.innerHTML = '<i class="bi ' + (on ? 'bi-bookmark-check-fill' : 'bi-bookmark') + '" aria-hidden="true"></i>' + U.esc(on ? T('detail.saved', 'Saved') : T('save.add', 'Save scheme')); }
  drawSave();
  sb.addEventListener('click', function () {
    if (!u) { location.href = 'login.html?reason=save&next=' + encodeURIComponent('scheme.html?slug=' + s.slug); return; }
    var on = S.toggleSave(u.id, s.id); sb.setAttribute('aria-pressed', on); drawSave(); U.toast(on ? T('toast.saved', 'Scheme saved') : T('toast.unsaved', 'Removed from saved'), 'success');
  });
  // portal (leaving notice)
  var lm = new bootstrap.Modal(U.$('#leave-modal'));
  U.$('#portal-btn').addEventListener('click', function () { U.$('#leave-go').href = s.official_url; U.$('#leave-url').textContent = s.official_url; lm.show(); });
  U.$('#leave-go').addEventListener('click', function () { lm.hide(); });
  // checklist
  function prog() {
    var ids = U.$$('#p-documents input[type=checkbox]:checked').map(function (x) { return x.value; }); S.setChecklist(s.id, ids);
    U.$('#doc-prog .progress-bar').style.width = (ids.length * 100 / docs.length) + '%'; U.$('#doc-prog').setAttribute('aria-valuenow', ids.length);
    U.$('#doc-prog-label').textContent = ids.length + ' ' + T('docs.of', 'of') + ' ' + docs.length + ' ' + T('docs.ready', 'documents ready');
  }
  U.$$('#p-documents input[type=checkbox]').forEach(function (x) { x.addEventListener('change', prog); }); prog();
  U.$('#print-btn').addEventListener('click', function () { window.print(); });
  // tabs ↔ hash
  function openTab(h) { var b = U.$('#tab-' + h); if (b) bootstrap.Tab.getOrCreateInstance(b).show(); }
  if (location.hash) openTab(location.hash.slice(1));
  window.addEventListener('hashchange', function () { openTab(location.hash.slice(1)); });
  U.$$('.cc-tabs [data-bs-toggle=tab]').forEach(function (b) { b.addEventListener('shown.bs.tab', function () { history.replaceState(null, '', '#' + b.id.replace('tab-', '')); }); });
  // scheme assistant
  CC.bot.mount(U.$('#scheme-bot'), { scope: 'scheme', scheme: s });
  // feedback (state A)
  var fb = U.$('#feedback');
  function fbAsk() {
    fb.innerHTML = '<div class="d-flex flex-wrap align-items-center gap-3"><h2 id="fb-h" class="h5 mb-0">' + U.esc(T('fb.q', 'Was this information useful?')) + '</h2><div class="d-flex gap-2"><button class="btn btn-outline-primary" data-fb="1"><i class="bi bi-hand-thumbs-up" aria-hidden="true"></i>' + U.esc(T('common.yes', 'Yes')) + '</button><button class="btn btn-outline-primary" data-fb="0"><i class="bi bi-hand-thumbs-down" aria-hidden="true"></i>' + U.esc(T('common.no', 'No')) + '</button></div></div>';
    U.$$('[data-fb]', fb).forEach(function (b) { b.addEventListener('click', function () {
      if (b.getAttribute('data-fb') === '1') { S.giveFeedback(s.id, true); thanks(); return; }
      fb.innerHTML = '<form id="fb-form"><h2 id="fb-h" class="h5">' + U.esc(T('fb.what', 'What was missing or unclear?')) + ' <span class="text-muted small fw-normal">(' + U.esc(T('fb.optional', 'optional')) + ')</span></h2><label class="visually-hidden" for="fb-t">' + U.esc(T('fb.what', 'What was missing or unclear?')) + '</label><textarea id="fb-t" class="form-control mb-1" rows="3" maxlength="200"></textarea><div class="form-text mb-2"><span id="fb-n">0</span>/200</div><button class="btn btn-primary">' + U.esc(T('fb.submit', 'Submit feedback')) + '</button></form>';
      U.$('#fb-t').addEventListener('input', function () { U.$('#fb-n').textContent = this.value.length; }); U.$('#fb-t').focus();
      U.$('#fb-form').addEventListener('submit', function (e) { e.preventDefault(); S.giveFeedback(s.id, false, U.$('#fb-t').value.trim()); thanks(); });
    }); });
  }
  function thanks() { fb.innerHTML = '<div class="ok-box" role="status"><i class="bi bi-check-circle-fill" aria-hidden="true"></i><div><strong id="fb-h">' + U.esc(T('fb.thanks', 'Thank you — this helps us improve.')) + '</strong> <button class="btn btn-link p-0 align-baseline" style="min-height:0" id="fb-change">' + U.esc(T('fb.change', 'Change answer')) + '</button></div></div>'; U.$('#fb-change').onclick = fbAsk; }
  fbAsk();
})();
