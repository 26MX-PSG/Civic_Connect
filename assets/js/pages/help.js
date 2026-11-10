/* Help & FAQs + document guide + general assistant (inline) */
(function () {
  var U = CC.ui, T = CC.i18n.t, S = CC.store, ta = CC.i18n.lang === 'ta';
  var topic = '', all = S.faqs();
  var topics = []; all.forEach(function (f) { if (topics.indexOf(f.topic) < 0) topics.push(f.topic); });
  function drawTopics() {
    U.$('#topics').innerHTML = ['' ].concat(topics).map(function (t) { return '<button type="button" class="chip' + (t === topic ? ' is-active' : '') + '" aria-pressed="' + (t === topic) + '" data-topic="' + t + '">' + U.esc(t ? T('topic.' + t, t) : T('filter.all', 'All')) + '</button>'; }).join('');
    U.$$('[data-topic]').forEach(function (b) { b.addEventListener('click', function () { topic = b.getAttribute('data-topic'); drawTopics(); drawFaqs(); }); });
  }
  function drawFaqs() {
    var list = S.faqs({ keyword: U.$('#faq-q').value, topic: topic });
    U.$('#faq-count').textContent = list.length + ' ' + T('help.questions', 'questions');
    U.$('#faq-list').innerHTML = list.length ? list.map(function (f) {
      var q = ta && f.q_ta ? f.q_ta : f.q_en, a = ta && f.a_ta ? f.a_ta : f.a_en, cat = f.category_id ? S.category(f.category_id) : null;
      return '<div class="accordion-item" id="faq-' + f.id + '"><h3 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#fa-' + f.id + '" aria-expanded="false" aria-controls="fa-' + f.id + '">' + U.esc(q) + '</button></h3>' +
        '<div id="fa-' + f.id + '" class="accordion-collapse collapse" data-bs-parent="#faq-list"><div class="accordion-body">' + U.esc(a) + '<div class="mt-2 d-flex gap-2 flex-wrap"><span class="badge-cc b-cat">' + U.esc(T('topic.' + f.topic, f.topic)) + '</span>' + (cat ? '<span class="badge-cc b-state">' + U.esc(U.cName(cat)) + '</span>' : '') + '</div></div></div></div>';
    }).join('') : '<div class="panel">' + U.empty('question-circle', T('help.none', 'No questions match'), T('help.noneT', 'Try another word, or ask the assistant on this page.')) + '</div>';
  }
  U.$('#doc-list').innerHTML = S.db().documents.map(function (d) {
    var used = S.schemes().filter(function (s) { return s.documents.some(function (x) { return x.id === d.id; }); });
    return '<div class="doc-guide-item" id="doc-' + d.id + '"><h3 class="h6 mb-1"><i class="bi bi-file-earmark-text" aria-hidden="true"></i> ' + U.esc(U.dName(d)) + '</h3><p class="mb-1 small">' + U.esc(ta && d.where_ta ? d.where_ta : d.where_en) + (d.link ? ' <a href="' + d.link + '" target="_blank" rel="noopener">' + U.esc(d.link_label) + ' <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a>' : '') + '</p>' +
      (used.length ? '<p class="small text-muted mb-0">' + U.esc(T('help.usedBy', 'Needed for')) + ': ' + used.map(function (s) { return '<a href="scheme.html?slug=' + s.slug + '#documents">' + U.esc(U.sName(s).split(' (')[0]) + '</a>'; }).join(', ') + '</p>' : '') + '</div>';
  }).join('');
  drawTopics(); drawFaqs();
  var t; U.$('#faq-q').addEventListener('input', function () { clearTimeout(t); t = setTimeout(drawFaqs, 200); });
  U.$('#faq-form').addEventListener('submit', function (e) { e.preventDefault(); drawFaqs(); });
  CC.bot.mount(U.$('#help-bot'), { scope: 'general' });
  // deep links: #faq-3 opens that answer, #doc-aadhaar scrolls to the guide entry
  var h = location.hash;
  if (/^#faq-\d+/.test(h)) { var el = U.$('#fa-' + h.slice(5)); if (el) { new bootstrap.Collapse(el, { toggle: true }); setTimeout(function () { U.$(h).scrollIntoView({ block: 'center' }); }, 150); } }
  else if (/^#doc-/.test(h) && U.$(h)) setTimeout(function () { U.$(h).scrollIntoView({ block: 'center' }); }, 100);
})();
