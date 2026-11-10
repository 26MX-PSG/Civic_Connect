/* Admin: unanswered queries (search + chatbots), feedback, users, announcements */
(function () {
  var U = CC.ui, T = CC.i18n.t, S = CC.store;
  var me = U.requireLogin('ADMIN'); if (!me) return;
  var d = S.db(), src = '';
  var tabMap = { queries: '#t-q', feedback: '#t-f', users: '#t-u', announce: '#t-n' };
  if (U.param('tab') && tabMap[U.param('tab')]) bootstrap.Tab.getOrCreateInstance(U.$('[data-bs-target="' + tabMap[U.param('tab')] + '"]')).show();
  var SRC = { SEARCH: ['search', T('aa.src.search', 'Search')], CHATBOT_GENERAL: ['chat-dots', T('aa.src.general', 'General assistant')], CHATBOT_SCHEME: ['journal-text', T('aa.src.scheme', 'Scheme assistant')] };
  var STATUS = { NEW: T('aa.st.new', 'New'), REVIEWED: T('aa.st.reviewed', 'Reviewed'), SCHEME_ADDED: T('aa.st.added', 'Added to FAQ / scheme'), IGNORED: T('aa.st.ignored', 'Ignored') };
  function drawQ() {
    U.$('#q-filters').innerHTML = [['', T('filter.all', 'All')]].concat(Object.keys(SRC).map(function (k) { return [k, SRC[k][1]]; })).map(function (x) {
      var n = d.queries.filter(function (q) { return !x[0] || q.source === x[0]; }).length;
      return '<button type="button" class="chip' + (src === x[0] ? ' is-active' : '') + '" aria-pressed="' + (src === x[0]) + '" data-src="' + x[0] + '">' + U.esc(x[1]) + ' (' + n + ')</button>';
    }).join('');
    U.$$('[data-src]').forEach(function (b) { b.onclick = function () { src = b.getAttribute('data-src'); drawQ(); }; });
    var list = d.queries.filter(function (q) { return !src || q.source === src; }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
    U.$('#q-rows').innerHTML = list.length ? list.map(function (q) {
      var s = SRC[q.source] || SRC.SEARCH, sc = q.scheme_id ? S.scheme(q.scheme_id) : null;
      return '<tr><td class="fw-semibold">' + U.esc(q.query_text) + '</td><td class="small text-nowrap"><i class="bi bi-' + s[0] + '" aria-hidden="true"></i> ' + U.esc(s[1]) + (sc ? '<div class="text-muted">' + U.esc(sc.name_en.split(' (')[0]) + '</div>' : '') + '</td><td>' + (q.count || 1) + '</td><td class="small text-nowrap">' + U.esc(U.date(q.created_at)) + '</td>' +
        '<td><label class="visually-hidden" for="qs-' + q.id + '">' + U.esc(T('as.status', 'Status')) + '</label><select class="form-select form-select-sm" style="min-height:38px;width:auto" id="qs-' + q.id + '" data-qid="' + q.id + '">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (q.review_status === k ? ' selected' : '') + '>' + U.esc(STATUS[k]) + '</option>'; }).join('') + '</select></td></tr>';
    }).join('') : '<tr><td colspan="5">' + U.empty('inbox', T('aa.noQ', 'No unanswered queries'), T('aa.noQT', 'Searches and chatbot questions that find nothing appear here.')) + '</td></tr>';
    U.$$('[data-qid]').forEach(function (s) { s.onchange = function () { d.queries.find(function (q) { return q.id == s.getAttribute('data-qid'); }).review_status = s.value; S.save(); badge(); U.toast(T('common.savedMsg', 'Changes saved'), 'success'); }; });
    badge();
  }
  function badge() { var n = d.queries.filter(function (q) { return q.review_status === 'NEW'; }).length; U.$('#q-badge').textContent = n ? n + ' ' + T('aa.st.new', 'New') : ''; }
  function drawF() {
    U.$('#f-rows').innerHTML = d.schemes.map(function (s) {
      var f = d.feedback.find(function (x) { return x.scheme_id === s.id; }) || { yes: 0, no: 0, comments: [] }, n = f.yes + f.no, pct = n ? Math.round(f.yes * 100 / n) : null;
      return '<tr><td class="fw-semibold">' + U.esc(s.name_en) + '</td><td>' + f.yes + '</td><td>' + f.no + '</td><td>' + (pct === null ? '—' : '<span class="badge-cc ' + (pct >= 80 ? 'b-active' : 'b-overdue') + '">' + pct + '%</span>') + '</td><td class="small">' + (f.comments.length ? f.comments.map(function (c) { return '<div>“' + U.esc(c) + '”</div>'; }).join('') : '<span class="text-muted">—</span>') + '</td></tr>';
    }).join('');
  }
  function drawU() {
    U.$('#u-rows').innerHTML = d.users.filter(function (x) { return x.role === 'USER'; }).map(function (x) {
      return '<tr><td class="fw-semibold">' + U.esc(x.name) + '</td><td>' + U.esc(x.email) + '</td><td class="small">' + U.esc(U.date(x.created_at)) + '</td><td>' + (x.is_active ? '<span class="badge-cc b-active">' + U.esc(T('status.active', 'Active')) + '</span>' : '<span class="badge-cc b-inactive">' + U.esc(T('aa.disabled', 'Disabled')) + '</span>') + '</td>' +
        '<td class="text-end"><button class="btn btn-sm btn-ghost' + (x.is_active ? ' text-danger' : '') + '" data-u="' + x.id + '">' + U.esc(x.is_active ? T('aa.disable', 'Disable') : T('aa.enable', 'Enable')) + '</button></td></tr>';
    }).join('');
    U.$$('[data-u]').forEach(function (b) { b.onclick = function () { var x = d.users.find(function (y) { return y.id == b.getAttribute('data-u'); }); x.is_active = !x.is_active; S.save(); drawU(); U.toast(T('common.savedMsg', 'Changes saved'), 'success'); }; });
  }
  U.$('#announce-form').addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target; f.classList.add('was-validated'); if (!f.checkValidity()) return;
    var en = U.$('#an-en').value.trim(), taT = U.$('#an-ta').value.trim();
    var users = d.users.filter(function (x) { return x.role === 'USER' && x.is_active; });
    users.forEach(function (x, i) { d.notifications.push({ id: Date.now() + i, user_id: x.id, scheme_id: null, type: 'ANNOUNCEMENT', title_en: en, title_ta: taT || en, is_read: false, created_at: new Date().toISOString().slice(0, 10) }); });
    S.save(); f.reset(); f.classList.remove('was-validated');
    U.toast(T('aa.sent', 'Announcement sent to') + ' ' + users.length + ' ' + T('aa.citizens', 'citizens') + ' (' + users.filter(function (x) { return x.email_notifications; }).length + ' ' + T('aa.byEmail', 'by email') + ')', 'success');
  });
  drawQ(); drawF(); drawU();
})();
