/* Admin dashboard */
(function () {
  var U = CC.ui, T = CC.i18n.t, S = CC.store;
  if (!U.requireLogin('ADMIN')) return;
  var st = S.stats(), d = S.db();
  U.$('#stats').innerHTML = [
    ['journal-check', st.activeSchemes + ' / ' + st.totalSchemes, T('ad.active', 'Active schemes'), 'schemes.html'],
    ['people', st.users, T('ad.users', 'Registered citizens'), 'activity.html?tab=users'],
    ['search', st.newQueries, T('ad.newQueries', 'New unanswered queries'), 'activity.html'],
    ['hand-thumbs-up', st.usefulPct + '%', T('ad.usefulPct', 'Found pages useful') + ' (' + st.responses + ')', 'activity.html?tab=feedback']
  ].map(function (x) { return '<div class="col"><a class="card stat text-decoration-none h-100" href="' + x[3] + '"><span class="ico"><i class="bi bi-' + x[0] + '" aria-hidden="true"></i></span><span><span class="num d-block">' + U.esc(x[1]) + '</span><span class="lbl">' + U.esc(x[2]) + '</span></span></a></div>'; }).join('');
  var over = d.schemes.filter(function (s) { return U.daysSince(s.last_verified_on) > 90; });
  var newQ = d.queries.filter(function (q) { return q.review_status === 'NEW'; });
  var items = over.map(function (s) { return '<div class="notif"><span class="crit-ico unknown"><i class="bi bi-clock-history" aria-hidden="true"></i></span><div class="flex-grow-1"><div class="fw-semibold">' + U.esc(s.name_en) + '</div><div class="small text-muted">' + U.esc(T('ad.overdueT', 'Not verified for')) + ' ' + U.daysSince(s.last_verified_on) + ' ' + U.esc(T('ad.days', 'days')) + '</div></div><a class="btn btn-sm btn-outline-primary" href="schemes.html?edit=' + s.id + '">' + U.esc(T('ad.verify', 'Verify')) + '</a></div>'; })
    .concat(newQ.length ? ['<div class="notif"><span class="crit-ico none"><i class="bi bi-search" aria-hidden="true"></i></span><div class="flex-grow-1"><div class="fw-semibold">' + newQ.length + ' ' + U.esc(T('ad.newQueries', 'New unanswered queries')) + '</div><div class="small text-muted">' + U.esc(newQ.slice(0, 3).map(function (q) { return '“' + q.query_text + '”'; }).join(', ')) + '</div></div><a class="btn btn-sm btn-outline-primary" href="activity.html">' + U.esc(T('ad.review', 'Review queries')) + '</a></div>'] : []);
  U.$('#attention').innerHTML = items.length ? items.join('') : U.empty('check2-circle', T('ad.allGood', 'All caught up'), T('ad.allGoodT', 'Every scheme was verified in the last 90 days.'));
  var bq = d.queries.filter(function (q) { return /CHATBOT/.test(q.source); }).slice(0, 5);
  U.$('#bot-activity').innerHTML = (bq.length ? bq.map(function (q) {
    var sc = q.scheme_id ? S.scheme(q.scheme_id) : null;
    return '<div class="notif"><span class="crit-ico none"><i class="bi bi-' + (q.source === 'CHATBOT_SCHEME' ? 'journal-text' : 'chat-dots') + '" aria-hidden="true"></i></span><div><div class="fw-semibold">“' + U.esc(q.query_text) + '”</div><div class="small text-muted">' + U.esc(q.source === 'CHATBOT_SCHEME' ? T('aa.src.scheme', 'Scheme assistant') + (sc ? ' · ' + sc.name_en : '') : T('aa.src.general', 'General assistant')) + ' · ' + U.esc(U.date(q.created_at)) + '</div></div></div>';
  }).join('') : U.empty('chat-dots', T('ad.noBot', 'No unanswered chatbot questions'), '')) +
    '<p class="small text-muted mt-2 mb-0"><i class="bi bi-lightbulb" aria-hidden="true"></i> ' + U.esc(T('ad.botTip', 'Turn common questions into FAQs — both assistants will start answering them immediately.')) + ' <a href="content.html?tab=faqs">' + U.esc(T('ac.addFaq', 'Add FAQ')) + '</a></p>';
  U.$('#fb-rows').innerHTML = d.feedback.slice().sort(function (a, b) { return (b.yes + b.no) - (a.yes + a.no); }).slice(0, 6).map(function (f) {
    var s = S.scheme(f.scheme_id), n = f.yes + f.no, pct = n ? Math.round(f.yes * 100 / n) : 0;
    return '<tr><td class="fw-semibold">' + U.esc(s.name_en) + '</td><td>' + n + '</td><td><span class="badge-cc ' + (pct >= 80 ? 'b-active' : 'b-overdue') + '">' + pct + '%</span></td><td class="small text-muted">' + U.esc(f.comments[f.comments.length - 1] || '—') + '</td></tr>';
  }).join('');
})();
document.getElementById('reset-demo').addEventListener('click', function () {
  if (!confirm(CC.i18n.t('ad.resetQ', 'Reset all demo data (schemes, users, queries, feedback) to the original sample? You will stay logged in.'))) return;
  CC.store.reset(); location.reload();
});
