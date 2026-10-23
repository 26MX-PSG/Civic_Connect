/* CivicConnect — shared layout + UI helpers.
 * Renders the header, mobile bottom nav, footer and admin sidebar,
 * and provides small helpers (cards, badges, toasts, states) used by every page.
 */
window.CC = window.CC || {};

CC.ui = (function () {
  var body = document.body;
  var base = body.getAttribute('data-base') || '';
  var page = body.getAttribute('data-page') || '';
  var T = function (k, en) { return CC.i18n.t(k, en); };
  var ta = function () { return CC.i18n.lang === 'ta'; };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }
  function param(n) { return new URLSearchParams(location.search).get(n); }
  function date(iso) {
    if (!iso) return '—';
    var d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    try { return d.toLocaleDateString(ta() ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return iso.slice(0, 10); }
  }
  function daysSince(iso) { return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5); }
  function label(code) { var l = CC.LABELS[code]; return l ? l[ta() ? 1 : 0] : code; }
  function sName(s) { return ta() && s.name_ta ? s.name_ta : s.name_en; }
  function sShort(s) { return ta() && s.short_ta ? s.short_ta : s.short_en; }
  function cName(c) { return c ? (ta() && c.name_ta ? c.name_ta : c.name_en) : ''; }
  function dName(d) { return d ? (ta() && d.name_ta ? d.name_ta : d.name_en) : ''; }

  /* image with a placeholder fallback: drop real photos in assets/img/... with the same name */
  function img(kind, slug, alt, cls) {
    var real = kind === 'cat' ? 'assets/img/categories/' + slug + '.jpg' : 'assets/img/' + slug + '.jpg';
    var ph = 'assets/img/placeholders/' + slug + '.svg';
    if ((CC.PHOTOS || []).indexOf(slug) < 0) return '<img class="' + (cls || '') + '" src="' + base + ph + '" alt="' + esc(alt || '') + '" loading="lazy">';
    return '<img class="' + (cls || '') + '" src="' + base + real + '" alt="' + esc(alt || '') + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + base + ph + '\'">';
  }

  /* ---------- badges ---------- */
  function levelBadge(s) { return s.level === 'CENTRAL' ? '<span class="badge-cc b-central">' + esc(label('CENTRAL')) + '</span>' : '<span class="badge-cc b-state">' + esc(label('STATE')) + '</span>'; }
  function matchBadge(status) {
    if (status === 'MATCH') return '<span class="badge-cc b-match"><i class="bi bi-check-circle-fill" aria-hidden="true"></i>' + esc(T('match.basic', 'Basic Criteria Match')) + '</span>';
    if (status === 'PARTIAL') return '<span class="badge-cc b-partial"><i class="bi bi-question-circle-fill" aria-hidden="true"></i>' + esc(T('match.partial', 'Partial match – complete your profile')) + '</span>';
    return '';
  }
  function demoRibbon() { return '<span class="demo-ribbon"><i class="bi bi-cone-striped" aria-hidden="true"></i>' + esc(T('demo.ribbon', 'Demo data – not yet verified')) + '</span>'; }

  /* ---------- cards ---------- */
  function schemeCard(s, opts) {
    opts = opts || {};
    var u = CC.store.currentUser(), saved = u ? CC.store.isSaved(u.id, s.id) : false;
    var c = CC.store.category(s.category_id);
    var extra = '';
    if (opts.result) {
      extra = '<div>' + matchBadge(opts.result.status) + '</div>';
      if (opts.result.reasons.length) extra += '<div class="why"><span class="small text-muted me-1">' + esc(T('rec.why', 'Why this matched')) + ':</span>' + opts.result.reasons.map(function (r) { return '<span class="chip chip-reason"><i class="bi bi-check2" aria-hidden="true"></i>' + esc(ta() && r.label_ta ? r.label_ta : r.label_en) + '</span>'; }).join('') + '</div>';
      if (opts.result.missing.length) extra += '<div class="why"><span class="small text-muted me-1">' + esc(T('rec.missing', 'Missing info')) + ':</span>' + opts.result.missing.map(function (m) { return '<a class="chip chip-missing" href="' + base + 'profile.html#f-' + m + '"><i class="bi bi-plus" aria-hidden="true"></i>' + esc(T('field.' + m, m)) + '</a>'; }).join('') + '</div>';
    }
    if (opts.progress) extra += '<div><div class="d-flex justify-content-between small mb-1"><span>' + esc(T('docs.progress', 'Documents ready')) + '</span><span>' + opts.progress.done + ' / ' + opts.progress.total + '</span></div><div class="progress" role="progressbar" aria-valuenow="' + opts.progress.done + '" aria-valuemin="0" aria-valuemax="' + opts.progress.total + '" aria-label="' + esc(T('docs.progress', 'Documents ready')) + '"><div class="progress-bar" style="width:' + (opts.progress.total ? opts.progress.done * 100 / opts.progress.total : 0) + '%"></div></div></div>';
    return '<article class="card scheme-card' + (s.is_active ? '' : ' inactive') + '">' +
      '<button type="button" class="bookmark" data-save="' + s.id + '" aria-pressed="' + saved + '" aria-label="' + esc((saved ? T('save.remove', 'Remove from saved') : T('save.add', 'Save scheme')) + ': ' + sName(s)) + '"><i class="bi ' + (saved ? 'bi-bookmark-fill' : 'bi-bookmark') + '" aria-hidden="true"></i></button>' +
      '<div class="meta">' + levelBadge(s) + '<span class="badge-cc b-cat">' + esc(cName(c)) + '</span>' + (s.is_active ? '' : '<span class="badge-cc b-inactive">' + esc(T('status.noLonger', 'No longer active')) + '</span>') + '</div>' +
      '<h3><a href="' + base + 'scheme.html?slug=' + s.slug + '">' + esc(sName(s)) + '</a></h3>' +
      '<p>' + esc(sShort(s)) + '</p>' + extra +
      '<div class="foot"><span class="text-muted small"><i class="bi bi-patch-check" aria-hidden="true"></i> ' + esc(T('common.verified', 'Verified')) + ' ' + esc(date(s.last_verified_on)) + '</span><span class="view">' + esc(T('common.viewDetails', 'View details')) + ' <i class="bi bi-arrow-right" aria-hidden="true"></i></span></div>' +
      (opts.remove ? '<button type="button" class="btn btn-sm btn-ghost align-self-start" style="position:relative;z-index:2" data-remove="' + s.id + '"><i class="bi bi-trash3" aria-hidden="true"></i>' + esc(T('saved.remove', 'Remove')) + '</button>' : '') +
      '</article>';
  }
  /* wire bookmark buttons inside a container */
  function bindSave(root, onChange) {
    $$('[data-save]', root).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var u = CC.store.currentUser();
        if (!u) { location.href = base + 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search) + '&reason=save'; return; }
        var on = CC.store.toggleSave(u.id, b.getAttribute('data-save'));
        b.setAttribute('aria-pressed', on); b.innerHTML = '<i class="bi ' + (on ? 'bi-bookmark-fill' : 'bi-bookmark') + '" aria-hidden="true"></i>';
        toast(on ? T('toast.saved', 'Scheme saved') : T('toast.unsaved', 'Removed from saved'), 'success');
        if (onChange) onChange(on, b.getAttribute('data-save'));
      });
    });
  }
  function catCard(c) {
    return '<a class="card cat-card" href="' + base + 'schemes.html?category=' + c.slug + '"><span class="cat-icon"><i class="bi bi-' + c.icon + '" aria-hidden="true"></i></span><span><span class="name d-block">' + esc(cName(c)) + '</span><span class="count">' + c.scheme_count + ' ' + esc(c.scheme_count === 1 ? T('common.scheme', 'scheme') : T('common.schemes', 'schemes')) + '</span></span></a>';
  }
  function catTile(c) {
    return '<a class="card cat-tile" href="' + base + 'schemes.html?category=' + c.slug + '">' + img('cat', c.slug, '') + '<span class="body"><span class="cat-icon"><i class="bi bi-' + c.icon + '" aria-hidden="true"></i></span><span><span class="name d-block fw-semibold">' + esc(cName(c)) + '</span><span class="count small text-muted">' + c.scheme_count + ' ' + esc(c.scheme_count === 1 ? T('common.scheme', 'scheme') : T('common.schemes', 'schemes')) + '</span></span></span></a>';
  }

  /* ---------- states ---------- */
  function skeletonCards(n) { var h = ''; for (var i = 0; i < (n || 3); i++) h += '<div class="col"><div class="card p-3" aria-hidden="true"><div class="skeleton mb-2" style="height:22px;width:40%"></div><div class="skeleton mb-2" style="height:20px;width:85%"></div><div class="skeleton mb-3" style="height:40px"></div><div class="skeleton" style="height:16px;width:50%"></div></div></div>'; return h + '<span class="visually-hidden">' + esc(T('common.loading', 'Loading…')) + '</span>'; }
  function empty(icon, title, text, action) { return '<div class="empty-state"><div class="ico"><i class="bi bi-' + icon + '" aria-hidden="true"></i></div><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p>' + (action || '') + '</div>'; }
  function errorState(retryId) { return '<div class="empty-state"><div class="ico" style="background:#FEE2E2;color:var(--cc-error)"><i class="bi bi-wifi-off" aria-hidden="true"></i></div><h2>' + esc(T('error.title', 'Something went wrong')) + '</h2><p>' + esc(T('error.text', 'We couldn’t load this. Check your connection and try again.')) + '</p><button class="btn btn-primary" id="' + retryId + '"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i>' + esc(T('common.retry', 'Retry')) + '</button></div>'; }

  /* ---------- toast (aria-live) ---------- */
  function toast(msg, type, action) {
    var z = $('#toast-zone');
    var t = document.createElement('div'); t.className = 'cc-toast ' + (type || '');
    t.innerHTML = '<i class="bi ' + (type === 'error' ? 'bi-exclamation-circle' : 'bi-check-circle-fill') + '" aria-hidden="true"></i><span>' + esc(msg) + '</span>' + (action ? '<button type="button">' + esc(action.label) + '</button>' : '');
    if (action) t.querySelector('button').addEventListener('click', function () { action.fn(); t.remove(); });
    z.appendChild(t); setTimeout(function () { t.remove(); }, action ? 6000 : 3500);
  }

  /* ---------- auth guard ---------- */
  function requireLogin(role) {
    var u = CC.store.currentUser();
    if (!u || (role && u.role !== role)) {
      var here = location.pathname.split('/').slice(-2).join('/'); if (!/^admin\//.test(here)) here = here.split('/').pop();
      location.replace(base + 'login.html?next=' + encodeURIComponent(here + location.search) + (role === 'ADMIN' ? '&reason=admin' : ''));
      return null;
    }
    return u;
  }

  /* ---------- shell ---------- */
  function langToggle() {
    return '<div class="lang-toggle" role="group" aria-label="' + esc(T('lang.label', 'Language')) + '">' +
      '<button type="button" data-lang="en" aria-pressed="' + !ta() + '" lang="en">English</button>' +
      '<button type="button" data-lang="ta" class="ta" aria-pressed="' + ta() + '" lang="ta">தமிழ்</button></div>';
  }
  function initials(n) { return String(n || '?').split(' ').map(function (x) { return x[0]; }).join('').slice(0, 2).toUpperCase(); }

  function citizenHeader() {
    var u = CC.store.currentUser();
    var links = [['home', 'index.html', 'house', T('nav.home', 'Home')], ['discover', 'schemes.html', 'search', T('nav.discover', 'Discover')], ['categories', 'categories.html', 'grid', T('nav.categories', 'Categories')],
      ['saved', 'saved.html', 'bookmark', T('nav.saved', 'Saved')], ['help', 'help.html', 'question-circle', T('nav.help', 'Help')]];
    var acct = u ? '<div class="dropdown"><button class="account-btn dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false"><span class="avatar">' + esc(initials(u.name)) + '</span><span class="d-none d-md-inline">' + esc(u.name.split(' ')[0]) + '</span></button>' +
      '<ul class="dropdown-menu dropdown-menu-end">' +
      (u.role === 'ADMIN' ? '<li><a class="dropdown-item" href="' + base + 'admin/index.html"><i class="bi bi-speedometer2"></i>' + esc(T('nav.admin', 'Admin dashboard')) + '</a></li>' : '') +
      '<li><a class="dropdown-item" href="' + base + 'dashboard.html"><i class="bi bi-grid-1x2"></i>' + esc(T('nav.dashboard', 'My dashboard')) + '</a></li>' +
      '<li><a class="dropdown-item" href="' + base + 'recommendations.html"><i class="bi bi-stars"></i>' + esc(T('nav.recs', 'My matches')) + '</a></li>' +
      '<li><a class="dropdown-item" href="' + base + 'profile.html"><i class="bi bi-person"></i>' + esc(T('nav.profile', 'Profile')) + '</a></li>' +
      '<li><hr class="dropdown-divider"></li><li><button class="dropdown-item" data-logout><i class="bi bi-box-arrow-right"></i>' + esc(T('nav.logout', 'Log out')) + '</button></li></ul></div>'
      : '<a class="btn btn-primary" href="' + base + 'login.html"><i class="bi bi-person-circle" aria-hidden="true"></i><span>' + esc(T('nav.login', 'Log in')) + '</span></a>';
    return '<a class="skip-link" href="#main">' + esc(T('common.skip', 'Skip to content')) + '</a>' +
      '<div class="demo-strip">' + esc(T('demo.strip', 'Student project demo · scheme details are sample data — always confirm on the official portal.')) + '</div>' +
      '<header class="site-header"><nav class="navbar navbar-expand-lg" aria-label="' + esc(T('nav.main', 'Main')) + '"><div class="container gap-2">' +
      '<a class="brand" href="' + base + 'index.html"><span class="brand-mark" aria-hidden="true">CC</span><span>CivicConnect</span></a>' +
      '<ul class="navbar-nav main-nav d-none d-lg-flex flex-row mx-auto">' + links.map(function (l) { return '<li class="nav-item"><a class="nav-link' + (page === l[0] ? ' active" aria-current="page' : '') + '" href="' + base + l[1] + '"><i class="bi bi-' + l[2] + '" aria-hidden="true"></i>' + esc(l[3]) + '</a></li>'; }).join('') + '</ul>' +
      '<div class="d-flex align-items-center gap-2 ms-auto ms-lg-0">' + langToggle() + acct + '</div></div></nav></header>';
  }
  function bottomNav() {
    var u = CC.store.currentUser();
    var items = [['home', 'index.html', 'house', T('nav.home', 'Home')], ['discover', 'schemes.html', 'search', T('nav.discover', 'Discover')], ['saved', 'saved.html', 'bookmark', T('nav.saved', 'Saved')],
      u ? ['profile', 'profile.html', 'person', T('nav.profile', 'Profile')] : ['login', 'login.html', 'person', T('nav.login', 'Log in')]];
    return '<nav class="bottom-nav d-md-none" aria-label="' + esc(T('nav.mobile', 'Quick navigation')) + '">' + items.map(function (i) {
      var act = page === i[0] || (i[0] === 'profile' && (page === 'dashboard' || page === 'recommendations'));
      return '<a href="' + base + i[1] + '"' + (act ? ' class="active" aria-current="page"' : '') + '><i class="bi bi-' + i[2] + (act ? '-fill' : '') + '" aria-hidden="true"></i>' + esc(i[3]) + '</a>';
    }).join('') + '</nav>';
  }
  function footer() {
    return '<footer class="site-footer"><div class="container"><div class="row g-4">' +
      '<div class="col-md-5"><a class="brand mb-2" style="color:#fff" href="' + base + 'index.html"><span class="brand-mark" aria-hidden="true">CC</span><span>CivicConnect</span></a><p class="mb-0">' + esc(T('footer.about', 'A bilingual guide to 15 selected government schemes. We help you understand and prepare — you apply on the official portal.')) + '</p></div>' +
      '<div class="col-6 col-md-3"><h2>' + esc(T('footer.explore', 'Explore')) + '</h2><ul class="list-unstyled d-grid gap-2"><li><a href="' + base + 'schemes.html">' + esc(T('footer.all', 'All 15 schemes')) + '</a></li><li><a href="' + base + 'categories.html">' + esc(T('nav.categories', 'Categories')) + '</a></li><li><a href="' + base + 'recommendations.html">' + esc(T('nav.recs', 'My matches')) + '</a></li></ul></div>' +
      '<div class="col-6 col-md-4"><h2>' + esc(T('footer.support', 'Support')) + '</h2><ul class="list-unstyled d-grid gap-2"><li><a href="' + base + 'help.html">' + esc(T('nav.helpfaq', 'Help & FAQs')) + '</a></li><li><a href="' + base + 'help.html#doc-guide">' + esc(T('help.docGuide', 'Document guide')) + '</a></li><li><button type="button" class="btn btn-link p-0 text-white text-decoration-none" data-open-bot style="min-height:0">' + esc(T('bot.fab', 'Ask CivicConnect')) + '</button></li></ul></div></div>' +
      '<p class="disclaimer mb-0">' + esc(T('footer.disclaimer', 'CivicConnect is not a government website and does not accept applications. Matching is guidance only, not an official eligibility decision.')) + '</p></div></footer>';
  }
  function adminShell() {
    var u = CC.store.currentUser() || { name: 'Admin' };
    var links = [['admin-dash', 'admin/index.html', 'speedometer2', T('admin.nav.dash', 'Dashboard')], ['admin-schemes', 'admin/schemes.html', 'journal-text', T('admin.nav.schemes', 'Schemes')],
      ['admin-content', 'admin/content.html', 'collection', T('admin.nav.content', 'Categories, FAQs & chatbot')], ['admin-activity', 'admin/activity.html', 'inbox', T('admin.nav.activity', 'Queries, feedback & users')]];
    var nav = links.map(function (l) { return '<a class="side-link' + (page === l[0] ? ' active" aria-current="page' : '') + '" href="' + base + l[1] + '"><i class="bi bi-' + l[2] + '" aria-hidden="true"></i>' + esc(l[3]) + '</a>'; }).join('');
    var mainEl = $('#main');
    var shell = document.createElement('div'); shell.className = 'admin-shell';
    shell.innerHTML = '<aside class="admin-side" aria-label="' + esc(T('admin.nav.label', 'Admin navigation')) + '"><a class="brand" href="' + base + 'admin/index.html"><span class="brand-mark" aria-hidden="true">CC</span><span>Admin</span></a>' + nav +
      '<div class="side-foot"><a class="side-link" href="' + base + 'index.html"><i class="bi bi-box-arrow-up-left" aria-hidden="true"></i>' + esc(T('admin.nav.site', 'View site')) + '</a><a class="side-link" href="#" data-logout><i class="bi bi-box-arrow-right" aria-hidden="true"></i>' + esc(T('nav.logout', 'Log out')) + '</a></div></aside>' +
      '<div class="admin-main"><div class="admin-top"><button class="btn btn-outline-primary btn-sm d-lg-none" data-bs-toggle="offcanvas" data-bs-target="#admin-menu" aria-label="' + esc(T('admin.menu', 'Menu')) + '"><i class="bi bi-list" aria-hidden="true"></i></button>' +
      '<span class="fw-semibold text-truncate" style="color:var(--cc-primary)">' + esc(document.title.split('·')[0]) + '</span><div class="ms-auto d-flex align-items-center gap-2">' + langToggle() + '<span class="avatar" title="' + esc(u.name) + '">' + esc(initials(u.name)) + '</span></div></div></div>' +
      '<div class="offcanvas offcanvas-start" tabindex="-1" id="admin-menu" style="background:var(--cc-primary);max-width:280px"><div class="offcanvas-body admin-side d-flex" style="position:static;height:auto">' +
      '<a class="brand" href="' + base + 'admin/index.html"><span class="brand-mark" aria-hidden="true">CC</span><span>Admin</span></a>' + nav + '<div class="side-foot"><a class="side-link" href="' + base + 'index.html"><i class="bi bi-box-arrow-up-left" aria-hidden="true"></i>' + esc(T('admin.nav.site', 'View site')) + '</a><a class="side-link" href="#" data-logout><i class="bi bi-box-arrow-right" aria-hidden="true"></i>' + esc(T('nav.logout', 'Log out')) + '</a></div></div></div>';
    mainEl.parentNode.insertBefore(shell, mainEl);
    shell.querySelector('.admin-main').appendChild(mainEl);
    mainEl.classList.add('admin-content');
  }

  function init() {
    var isAdmin = /^admin/.test(page);
    var tz = document.createElement('div'); tz.id = 'toast-zone'; tz.className = 'toast-zone'; tz.setAttribute('aria-live', 'polite'); tz.setAttribute('role', 'status'); document.body.appendChild(tz);
    if (isAdmin) { body.classList.add('admin-body'); adminShell(); }
    else {
      var h = $('#app-header'); if (h) h.outerHTML = citizenHeader();
      var f = $('#app-footer'); if (f) f.outerHTML = footer() + bottomNav();
      if (page !== 'login' && page !== 'help') CC.bot.floating();
    }
    CC.i18n.apply(document);
    $$('[data-lang]').forEach(function (b) { b.addEventListener('click', function () { CC.i18n.set(b.getAttribute('data-lang')); }); });
    document.addEventListener('click', function (e) {
      var lo = e.target.closest('[data-logout]'); if (lo) { e.preventDefault(); CC.store.logout(); location.href = base + 'index.html'; }
      var ob = e.target.closest('[data-open-bot]'); if (ob && CC.bot.open) { e.preventDefault(); CC.bot.open(ob.getAttribute('data-q') || ''); }
    });
  }

  return { base: base, page: page, esc: esc, $: $, $$: $$, param: param, date: date, daysSince: daysSince, label: label, sName: sName, sShort: sShort, cName: cName, dName: dName,
    img: img, levelBadge: levelBadge, matchBadge: matchBadge, demoRibbon: demoRibbon, schemeCard: schemeCard, bindSave: bindSave, catCard: catCard, catTile: catTile,
    skeletonCards: skeletonCards, empty: empty, errorState: errorState, toast: toast, requireLogin: requireLogin, init: init };
})();
CC.ui.init();
