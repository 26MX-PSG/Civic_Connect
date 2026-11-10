/* Admin: categories, FAQs, chatbot knowledge + test console */
(function () {
  var U = CC.ui, T = CC.i18n.t, S = CC.store;
  if (!U.requireLogin('ADMIN')) return;
  var d = S.db(), modal = new bootstrap.Modal(U.$('#edit-modal')), onSave = null;
  var tabMap = { categories: '#t-cats', faqs: '#t-faqs', chatbot: '#t-bot' };
  if (U.param('tab') && tabMap[U.param('tab')]) bootstrap.Tab.getOrCreateInstance(U.$('[data-bs-target="' + tabMap[U.param('tab')] + '"]')).show();

  function sw(id, on, attr) { return '<div class="form-check form-switch mb-0"><input class="form-check-input" type="checkbox" role="switch" ' + attr + '="' + id + '"' + (on ? ' checked' : '') + ' aria-label="' + U.esc(T('ac.enabled', 'Enabled')) + '"></div>'; }
  function drawCats() {
    U.$('#cat-rows').innerHTML = S.categories({ all: true }).map(function (c) {
      return '<tr><td><span class="cat-icon" style="width:40px;height:40px;font-size:1.1rem"><i class="bi bi-' + c.icon + '" aria-hidden="true"></i></span></td><td class="fw-semibold">' + U.esc(c.name_en) + '</td><td lang="ta">' + U.esc(c.name_ta) + '</td><td>' + c.scheme_count + '</td><td>' + sw(c.id, c.is_active, 'data-cat-on') + '</td><td class="text-end"><button class="btn btn-sm btn-outline-primary" data-cat-edit="' + c.id + '"><i class="bi bi-pencil" aria-hidden="true"></i>' + U.esc(T('common.edit', 'Edit')) + '</button></td></tr>';
    }).join('');
    U.$$('[data-cat-on]').forEach(function (i) { i.onchange = function () { S.category(i.getAttribute('data-cat-on')).is_active = i.checked; S.save(); U.toast(T('common.savedMsg', 'Changes saved'), 'success'); }; });
    U.$$('[data-cat-edit]').forEach(function (b) { b.onclick = function () {
      var c = S.category(b.getAttribute('data-cat-edit'));
      form(T('ac.editCat', 'Edit category'), '<div class="row g-3"><div class="col-md-6"><label class="form-label required" for="e-en">' + U.esc(T('ac.nameEn', 'Name (English)')) + '</label><input id="e-en" class="form-control" required value="' + U.esc(c.name_en) + '"></div><div class="col-md-6"><label class="form-label required" for="e-ta">' + U.esc(T('ac.nameTa', 'Name (Tamil)')) + '</label><input id="e-ta" lang="ta" class="form-control" required value="' + U.esc(c.name_ta) + '"></div><div class="col-md-6"><label class="form-label" for="e-icon">Bootstrap icon</label><input id="e-icon" class="form-control" value="' + U.esc(c.icon) + '"></div><div class="col-12"><label class="form-label" for="e-desc">' + U.esc(T('ac.desc', 'Description')) + '</label><textarea id="e-desc" class="form-control">' + U.esc(c.description) + '</textarea></div></div>',
        function () { c.name_en = U.$('#e-en').value.trim(); c.name_ta = U.$('#e-ta').value.trim(); c.icon = U.$('#e-icon').value.trim() || c.icon; c.description = U.$('#e-desc').value.trim(); S.save(); drawCats(); });
    }; });
  }
  var TOPICS = ['About', 'Applying', 'Matching', 'Documents', 'Account', 'Criteria', 'Assistant'];
  function drawFaqs() {
    U.$('#faq-rows').innerHTML = S.faqs({ all: true }).map(function (f) {
      var c = f.category_id ? S.category(f.category_id) : null;
      return '<tr><td class="fw-semibold" style="min-width:260px">' + U.esc(f.q_en) + '</td><td>' + U.esc(f.topic) + '</td><td>' + U.esc(c ? c.name_en : T('ac.general', 'General')) + '</td><td>' + (f.q_ta && f.a_ta ? '<span class="badge-cc b-active">✓</span>' : '<span class="badge-cc b-overdue">' + U.esc(T('ac.missing', 'Missing')) + '</span>') + '</td><td>' + sw(f.id, f.is_active !== false, 'data-faq-on') + '</td><td class="text-end"><button class="btn btn-sm btn-outline-primary" data-faq-edit="' + f.id + '"><i class="bi bi-pencil" aria-hidden="true"></i>' + U.esc(T('common.edit', 'Edit')) + '</button></td></tr>';
    }).join('');
    U.$$('[data-faq-on]').forEach(function (i) { i.onchange = function () { d.faqs.find(function (f) { return f.id == i.getAttribute('data-faq-on'); }).is_active = i.checked; S.save(); CC.bot.rebuild(); U.toast(T('common.savedMsg', 'Changes saved'), 'success'); }; });
    U.$$('[data-faq-edit]').forEach(function (b) { b.onclick = function () { faqForm(d.faqs.find(function (f) { return f.id == b.getAttribute('data-faq-edit'); })); }; });
  }
  function faqForm(f) {
    var x = f || { q_en: '', a_en: '', q_ta: '', a_ta: '', topic: 'About', category_id: null };
    form(f ? T('ac.editFaq', 'Edit FAQ') : T('ac.addFaq', 'Add FAQ'),
      '<div class="row g-3"><div class="col-md-6"><label class="form-label" for="e-topic">' + U.esc(T('ac.topic', 'Topic')) + '</label><select id="e-topic" class="form-select">' + TOPICS.map(function (t) { return '<option' + (t === x.topic ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
      '<div class="col-md-6"><label class="form-label" for="e-cat">' + U.esc(T('filter.category', 'Category')) + '</label><select id="e-cat" class="form-select"><option value="">' + U.esc(T('ac.general', 'General')) + '</option>' + d.categories.map(function (c) { return '<option value="' + c.id + '"' + (c.id === x.category_id ? ' selected' : '') + '>' + U.esc(c.name_en) + '</option>'; }).join('') + '</select></div>' +
      '<div class="col-md-6"><label class="form-label required" for="e-qen">' + U.esc(T('ac.qEn', 'Question (English)')) + '</label><textarea id="e-qen" class="form-control" required rows="2">' + U.esc(x.q_en) + '</textarea><div class="invalid-feedback">' + U.esc(T('common.required', 'This field is required.')) + '</div></div>' +
      '<div class="col-md-6"><label class="form-label" for="e-qta">' + U.esc(T('ac.qTa', 'Question (Tamil)')) + '</label><textarea id="e-qta" lang="ta" class="form-control" rows="2">' + U.esc(x.q_ta) + '</textarea></div>' +
      '<div class="col-md-6"><label class="form-label required" for="e-aen">' + U.esc(T('ac.aEn', 'Answer (English)')) + '</label><textarea id="e-aen" class="form-control" required rows="5">' + U.esc(x.a_en) + '</textarea><div class="invalid-feedback">' + U.esc(T('common.required', 'This field is required.')) + '</div></div>' +
      '<div class="col-md-6"><label class="form-label" for="e-ata">' + U.esc(T('ac.aTa', 'Answer (Tamil)')) + '</label><textarea id="e-ata" lang="ta" class="form-control" rows="5">' + U.esc(x.a_ta) + '</textarea></div>' +
      '<div class="col-12"><div class="ok-box small"><i class="bi bi-robot" aria-hidden="true"></i><span>' + U.esc(T('ac.faqBotNote', 'Saved FAQs are used by both chatbots straight away. Write the question the way citizens would ask it.')) + '</span></div></div></div>',
      function () {
        var o = { q_en: U.$('#e-qen').value.trim(), a_en: U.$('#e-aen').value.trim(), q_ta: U.$('#e-qta').value.trim(), a_ta: U.$('#e-ata').value.trim(), topic: U.$('#e-topic').value, category_id: U.$('#e-cat').value ? Number(U.$('#e-cat').value) : null, is_active: f ? f.is_active : true };
        if (f) o.id = f.id; S.upsert('faqs', o); CC.bot.rebuild(); drawFaqs(); drawKB();
      });
  }
  function form(title, html, save) { U.$('#em-h').textContent = title; U.$('#em-body').innerHTML = html; U.$('#edit-form').classList.remove('was-validated'); onSave = save; modal.show(); }
  U.$('#edit-form').addEventListener('submit', function (e) { e.preventDefault(); var f = e.target; f.classList.add('was-validated'); if (!f.checkValidity()) return; onSave(); modal.hide(); U.toast(T('common.savedMsg', 'Changes saved'), 'success'); });
  U.$('#faq-add').addEventListener('click', function () { faqForm(null); });

  /* ---------- chatbot knowledge ---------- */
  function drawKB() {
    var sch = S.schemes({ includeInactive: true });
    var rows = [
      ['question-circle', T('ac.kbFaq', 'FAQs'), S.faqs().length + ' ' + T('ac.kbActive', 'active'), T('ac.kbFaqT', 'Answers general questions (both assistants)'), 'help.html'],
      ['journal-text', T('ac.kbSchemes', 'Scheme pages'), sch.length + ' × 5 ' + T('ac.kbSections', 'sections'), T('ac.kbSchemesT', 'Overview, criteria, benefits, documents, source'), 'schemes.html'],
      ['file-earmark-text', T('help.docGuide', 'Document guide'), d.documents.length + ' ' + T('ac.kbDocs', 'documents'), T('ac.kbDocsT', 'Where to get each document + official link'), 'help.html#doc-guide'],
      ['tags', T('ac.kbSyn', 'Synonym concepts'), Object.keys(CC.bot.CONCEPTS).length, T('ac.kbSynT', 'Maps everyday / Tamil words to one keyword'), null],
      ['signpost-split', T('ac.kbIntents', 'Intents'), CC.bot.INTENTS.length, CC.bot.INTENTS.map(function (i) { return i.label[0]; }).join(', '), null]
    ];
    U.$('#kb-summary').innerHTML = rows.map(function (r) { return '<div class="notif"><span class="cat-icon" style="width:40px;height:40px;font-size:1.05rem"><i class="bi bi-' + r[0] + '" aria-hidden="true"></i></span><div><div class="fw-semibold">' + U.esc(r[1]) + ' <span class="badge-cc b-cat">' + U.esc(r[2]) + '</span></div><div class="small text-muted">' + U.esc(r[3]) + (r[4] ? ' · <a href="../' + r[4] + '">' + U.esc(T('ac.open', 'Open')) + '</a>' : '') + '</div></div></div>'; }).join('');
    U.$('#syn-list').innerHTML = '<div class="table-wrap"><div class="table-responsive"><table class="table table-cc"><thead><tr><th>' + U.esc(T('ac.keyword', 'Keyword')) + '</th><th>' + U.esc(T('ac.matches', 'Words that map to it')) + '</th></tr></thead><tbody>' +
      Object.keys(CC.bot.CONCEPTS).map(function (k) { return '<tr><td class="fw-semibold">#' + k + '</td><td>' + CC.bot.CONCEPTS[k].map(function (w) { return '<span class="kb-pill">' + U.esc(w) + '</span>'; }).join('') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }
  U.$('#test-scope').innerHTML = '<option value="">' + U.esc(T('aa.src.general', 'General assistant')) + '</option>' + S.schemes({ includeInactive: true }).map(function (s) { return '<option value="' + s.id + '">' + U.esc(T('aa.src.scheme', 'Scheme assistant') + ': ' + s.name_en.split(' (')[0]) + '</option>'; }).join('');
  U.$('#test-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var sid = U.$('#test-scope').value, sc = sid ? S.scheme(sid) : null;
    var a = CC.bot.analyse(U.$('#test-q').value, { scheme: sc });
    var rank = CC.bot.debug(U.$('#test-q').value, { scheme: sc }).faqRanking;
    var r = CC.bot.answer(U.$('#test-q').value, { scope: sc ? 'scheme' : 'general', scheme: sc });
    function pills(arr) { return arr.length ? arr.map(function (x) { return '<span class="kb-pill">' + U.esc(x) + '</span>'; }).join('') : '<span class="text-muted small">—</span>'; }
    U.$('#test-out').innerHTML = '<div class="table-wrap mb-3"><table class="table table-cc mb-0"><tbody>' +
      '<tr><th scope="row">1–4. ' + U.esc(T('ac.t.kw', 'Keywords (after stop words + stemming)')) + '</th><td>' + pills(a.keywords) + '</td></tr>' +
      '<tr><th scope="row">5. ' + U.esc(T('ac.t.concepts', 'Concepts (synonyms)')) + '</th><td>' + pills(a.concepts.map(function (c) { return '#' + c; })) + '</td></tr>' +
      '<tr><th scope="row">6. ' + U.esc(T('ac.t.entities', 'Scheme / document detected')) + '</th><td>' + pills(a.schemes.map(function (s) { return '★ ' + s.slug; }).concat(a.docs.map(function (x) { return '📄 ' + x; }))) + '</td></tr>' +
      '<tr><th scope="row">7. ' + U.esc(T('bot.intent', 'Intent')) + '</th><td>' + pills(a.intent ? [a.intent] : []) + '</td></tr>' +
      '<tr><th scope="row">8. ' + U.esc(T('ac.t.faq', 'Top FAQ scores')) + '</th><td>' + (rank.length ? rank.slice(0, 3).map(function (x) { return '<div class="small">' + x.score + ' — ' + U.esc(x.question) + '</div>'; }).join('') : '<span class="text-muted small">—</span>') + '</td></tr>' +
      '<tr><th scope="row">9. ' + U.esc(T('ac.t.source', 'Answer source')) + '</th><td>' + (r.sources.length ? r.sources.map(function (s) { return '<div class="small">' + U.esc(s.label) + '</div>'; }).join('') : '<span class="badge-cc b-overdue">' + U.esc(T('ac.t.fallback', 'No answer → logged for review')) + '</span>') + '</td></tr>' +
      '</tbody></table></div><div class="msg msg-bot" style="max-width:100%">' + r.html + '</div>';
  });
  drawCats(); drawFaqs(); drawKB();
  U.$('#test-form').dispatchEvent(new Event('submit'));
})();
