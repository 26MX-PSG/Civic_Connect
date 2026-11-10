/* Admin: scheme management (table + reusable add/edit form) */
(function () {
  var U = CC.ui, T = CC.i18n.t, S = CC.store, E = CC.ENUMS;
  if (!U.requireLogin('ADMIN')) return;
  var d = S.db(), pageNo = 1, PER = 10, editing = null, toDeact = null;
  var modal = new bootstrap.Modal(U.$('#scheme-modal')), confirmM = new bootstrap.Modal(U.$('#confirm-modal'));
  var TYPES = ['AGE', 'GENDER', 'ANNUAL_FAMILY_INCOME', 'OCCUPATION', 'STUDENT_LEVEL', 'FARMER_LAND_STATUS', 'DISABILITY_TYPE', 'DISTRICT'], OPS = ['=', '<', '<=', '>', '>=', 'IN', 'BETWEEN', 'IS_SET'];

  function draw() {
    var q = U.$('#as-q').value.toLowerCase(), f = U.$('#as-status').value;
    var list = d.schemes.filter(function (s) {
      if (q && (s.name_en + ' ' + s.name_ta + ' ' + s.slug).toLowerCase().indexOf(q) < 0) return false;
      if (f === 'active' && !s.is_active) return false; if (f === 'inactive' && s.is_active) return false; if (f === 'overdue' && U.daysSince(s.last_verified_on) <= 90) return false; return true;
    });
    var pages = Math.max(1, Math.ceil(list.length / PER)); pageNo = Math.min(pageNo, pages);
    var rows = list.slice((pageNo - 1) * PER, pageNo * PER);
    U.$('#as-rows').innerHTML = rows.length ? rows.map(function (s) {
      var od = U.daysSince(s.last_verified_on) > 90, c = S.category(s.category_id);
      return '<tr><td><div class="fw-semibold">' + U.esc(s.name_en) + '</div><div class="small text-muted" lang="ta">' + U.esc(s.name_ta) + '</div></td><td>' + U.esc(c.name_en) + '</td><td>' + U.levelBadge(s) + '</td>' +
        '<td>' + (s.is_active ? '<span class="badge-cc b-active">' + U.esc(T('status.active', 'Active')) + '</span>' : '<span class="badge-cc b-inactive">' + U.esc(T('status.inactive', 'Inactive')) + '</span>') + '</td>' +
        '<td class="text-nowrap">' + U.esc(U.date(s.last_verified_on)) + (od ? '<br><span class="badge-cc b-overdue"><i class="bi bi-clock-history" aria-hidden="true"></i>' + U.esc(T('status.overdue', 'Check overdue')) + '</span>' : '') + (s.is_verified ? '' : '<br><span class="small text-muted">' + U.esc(T('as.unverified', 'Unverified (demo)')) + '</span>') + '</td>' +
        '<td class="text-end text-nowrap"><button class="btn btn-sm btn-outline-primary" data-edit="' + s.id + '"><i class="bi bi-pencil" aria-hidden="true"></i>' + U.esc(T('common.edit', 'Edit')) + '</button> ' +
        '<button class="btn btn-sm ' + (s.is_active ? 'btn-ghost text-danger' : 'btn-ghost') + '" data-toggle="' + s.id + '">' + U.esc(s.is_active ? T('as.deactivate', 'Deactivate') : T('as.activate', 'Activate')) + '</button></td></tr>';
    }).join('') : '<tr><td colspan="6">' + U.empty('search', T('as.none', 'No schemes match'), T('as.noneT', 'Try a different search or status.')) + '</td></tr>';
    U.$('#as-page-info').textContent = list.length + ' ' + T('common.schemes', 'schemes') + ' · ' + T('as.page', 'Page') + ' ' + pageNo + ' / ' + pages;
    U.$('#as-pager').innerHTML = '<button class="btn btn-sm btn-outline-primary" ' + (pageNo === 1 ? 'disabled' : '') + ' data-pg="-1" aria-label="Previous"><i class="bi bi-chevron-left" aria-hidden="true"></i></button><button class="btn btn-sm btn-outline-primary" ' + (pageNo === pages ? 'disabled' : '') + ' data-pg="1" aria-label="Next"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>';
    U.$$('[data-pg]').forEach(function (b) { b.onclick = function () { pageNo += Number(b.getAttribute('data-pg')); draw(); }; });
    U.$$('[data-edit]').forEach(function (b) { b.onclick = function () { openForm(S.scheme(b.getAttribute('data-edit'))); }; });
    U.$$('[data-toggle]').forEach(function (b) { b.onclick = function () {
      var s = S.scheme(b.getAttribute('data-toggle'));
      if (s.is_active) { toDeact = s; U.$('#cm-text').textContent = s.name_en; confirmM.show(); } else { s.is_active = true; S.save(); draw(); U.toast(T('as.activated', 'Scheme activated'), 'success'); }
    }; });
    var full = d.schemes.length >= 15, ab = U.$('#add-btn'); ab.disabled = full;
    var tip = bootstrap.Tooltip.getInstance(U.$('#add-wrap')); if (tip) tip.dispose();
    if (full) new bootstrap.Tooltip(U.$('#add-wrap'), { title: T('as.limit', 'The curated list already has 15 schemes. Deactivate or edit one instead.') });
  }
  U.$('#cm-go').addEventListener('click', function () {
    toDeact.is_active = false;
    d.users.filter(function (x) { return (d.saved[x.id] || []).indexOf(toDeact.id) > -1; }).forEach(function (x) {
      d.notifications.push({ id: Date.now() + x.id, user_id: x.id, scheme_id: toDeact.id, type: 'SCHEME_DEACTIVATED', title_en: toDeact.name_en + ' is no longer active on CivicConnect', title_ta: toDeact.name_ta + ' இப்போது செயலில் இல்லை', is_read: false, created_at: new Date().toISOString().slice(0, 10) });
    });
    S.save(); confirmM.hide(); draw(); U.toast(T('as.deactivated', 'Scheme deactivated'), 'success');
  });

  /* ---------- reusable add/edit form ---------- */
  function field(id, label, val, attrs, help) { return '<div class="mb-3"><label class="form-label' + (/required/.test(attrs || '') ? ' required' : '') + '" for="' + id + '">' + U.esc(label) + '</label><input class="form-control" id="' + id + '" value="' + U.esc(val || '') + '" ' + (attrs || '') + '>' + (help ? '<div class="form-text">' + U.esc(help) + '</div>' : '') + '<div class="invalid-feedback">' + U.esc(T('common.required', 'This field is required.')) + '</div></div>'; }
  function area(id, label, val, attrs) { return '<div class="mb-3"><label class="form-label' + (/required/.test(attrs || '') ? ' required' : '') + '" for="' + id + '">' + U.esc(label) + '</label><textarea class="form-control" id="' + id + '" rows="3" ' + (attrs || '') + '>' + U.esc(val || '') + '</textarea><div class="invalid-feedback">' + U.esc(T('common.required', 'This field is required.')) + '</div></div>'; }
  function select(id, label, options, val) { return '<div class="mb-3"><label class="form-label required" for="' + id + '">' + U.esc(label) + '</label><select class="form-select" id="' + id + '" required>' + options.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + U.esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }
  function critRow(c, i) {
    return '<div class="row g-2 align-items-end mb-2" data-crit><div class="col-2"><label class="form-label small" for="cg' + i + '">' + U.esc(T('as.group', 'Group')) + '</label><input class="form-control" type="number" min="1" id="cg' + i + '" value="' + (c.group || 1) + '" data-k="group"></div>' +
      '<div class="col-md-3 col-10"><label class="form-label small" for="ct' + i + '">' + U.esc(T('as.ctype', 'Profile field')) + '</label><select class="form-select" id="ct' + i + '" data-k="type">' + TYPES.map(function (t) { return '<option' + (t === c.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
      '<div class="col-md-2 col-4"><label class="form-label small" for="co' + i + '">' + U.esc(T('as.op', 'Operator')) + '</label><select class="form-select" id="co' + i + '" data-k="op">' + OPS.map(function (o) { return '<option' + (o === c.op ? ' selected' : '') + '>' + U.esc(o) + '</option>'; }).join('') + '</select></div>' +
      '<div class="col-md-2 col-8"><label class="form-label small" for="cv' + i + '">' + U.esc(T('as.value', 'Value')) + '</label><input class="form-control" id="cv' + i + '" value="' + U.esc(c.value || '') + '" data-k="value"></div>' +
      '<div class="col-md-2 col-10"><label class="form-label small" for="cl' + i + '">' + U.esc(T('as.clabel', 'Label shown')) + '</label><input class="form-control" id="cl' + i + '" value="' + U.esc(c.label_en || '') + '" data-k="label_en"></div>' +
      '<div class="col-1 col-2"><button type="button" class="btn btn-ghost text-danger" data-rmcrit aria-label="' + U.esc(T('as.rmCrit', 'Remove criterion')) + '"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div></div>';
  }
  function openForm(s) {
    editing = s;
    var x = s || { name_en: '', name_ta: '', slug: '', category_id: 1, level: 'CENTRAL', state: '', short_en: '', short_ta: '', who_en: '', benefits_en: [], criteria: [], documents: [], official_url: 'https://', source_name: '', source_url: 'https://', last_verified_on: new Date().toISOString().slice(0, 10), is_verified: false, is_active: true };
    U.$('#sm-h').textContent = s ? T('as.editH', 'Edit scheme') : T('as.addH', 'Add scheme');
    var linked = {}; x.documents.forEach(function (dd) { linked[dd.id] = dd.mandatory; });
    U.$('#sm-body').innerHTML =
      '<h3 class="h5">1. ' + U.esc(T('as.secBasics', 'Basics')) + '</h3><div class="row"><div class="col-md-6">' + field('sf-name_en', T('ac.nameEn', 'Name (English)'), x.name_en, 'required maxlength="200"') + '</div><div class="col-md-6">' + field('sf-name_ta', T('ac.nameTa', 'Name (Tamil)'), x.name_ta, 'lang="ta" maxlength="200"') + '</div>' +
      '<div class="col-md-4">' + field('sf-slug', 'Slug (URL)', x.slug, 'required pattern="[a-z0-9-]+"', 'e.g. pm-kisan') + '</div><div class="col-md-4">' + select('sf-cat', T('filter.category', 'Category'), d.categories.map(function (c) { return [c.id, c.name_en]; }), x.category_id) + '</div><div class="col-md-2">' + select('sf-level', T('filter.type', 'Type'), [['CENTRAL', 'Central'], ['STATE', 'State']], x.level) + '</div><div class="col-md-2">' + field('sf-state', T('field.state', 'State'), x.state, 'placeholder="Tamil Nadu"') + '</div></div>' +
      '<h3 class="h5 mt-3">2. ' + U.esc(T('as.secSummary', 'Summary & benefits')) + '</h3><div class="row"><div class="col-md-6">' + area('sf-short_en', T('as.shortEn', 'Short description (English)'), x.short_en, 'required maxlength="300"') + '</div><div class="col-md-6">' + area('sf-short_ta', T('as.shortTa', 'Short description (Tamil)'), x.short_ta, 'lang="ta" maxlength="300"') + '</div>' +
      '<div class="col-md-6">' + area('sf-who', T('detail.whoFor', 'Who it is for'), x.who_en, 'required') + '</div><div class="col-md-6">' + area('sf-benefits', T('as.benefits', 'Benefits (one per line)'), x.benefits_en.join('\n'), 'required') + '</div></div>' +
      '<h3 class="h5 mt-3">3. ' + U.esc(T('tab.criteria', 'Basic criteria')) + '</h3><p class="small text-muted">' + U.esc(T('as.critHelp', 'Rows in the same group must all pass (AND). A scheme matches if any group passes (OR). IN uses a comma list, BETWEEN uses min,max, IS_SET needs no value.')) + '</p><div id="crit-rows">' + x.criteria.map(critRow).join('') + '</div><button type="button" class="btn btn-sm btn-outline-primary" id="add-crit"><i class="bi bi-plus" aria-hidden="true"></i>' + U.esc(T('as.addCrit', 'Add criterion')) + '</button>' +
      '<h3 class="h5 mt-4">4. ' + U.esc(T('tab.documents', 'Documents')) + '</h3><div class="row row-cols-1 row-cols-md-2 g-2">' + d.documents.map(function (dd) {
        return '<div class="col"><div class="d-flex gap-2 align-items-center border rounded-3 p-2"><input class="form-check-input mt-0" type="checkbox" id="sd-' + dd.id + '" data-doc="' + dd.id + '"' + (dd.id in linked ? ' checked' : '') + '><label for="sd-' + dd.id + '" class="flex-grow-1">' + U.esc(dd.name_en) + '</label><select class="form-select form-select-sm" style="width:auto;min-height:36px" data-mand="' + dd.id + '" aria-label="' + U.esc(dd.name_en) + ' – ' + U.esc(T('docs.required', 'Required')) + '"><option value="1"' + (linked[dd.id] !== false ? ' selected' : '') + '>' + U.esc(T('docs.required', 'Required')) + '</option><option value="0"' + (linked[dd.id] === false ? ' selected' : '') + '>' + U.esc(T('docs.optional', 'If applicable')) + '</option></select></div></div>';
      }).join('') + '</div>' +
      '<h3 class="h5 mt-4">5. ' + U.esc(T('tab.source', 'Source')) + '</h3><div class="row"><div class="col-md-6">' + field('sf-official', T('as.official', 'Official application URL (https)'), x.official_url, 'required type="url" pattern="https://.+"') + '</div><div class="col-md-6">' + field('sf-source_name', T('detail.dept', 'Department'), x.source_name, 'required') + '</div>' +
      '<div class="col-md-6">' + field('sf-source_url', T('detail.sourceLink', 'Source link'), x.source_url, 'required type="url" pattern="https://.+"') + '</div><div class="col-md-3">' + field('sf-verified_on', T('as.verified', 'Last verified'), x.last_verified_on, 'required type="date"') + '</div>' +
      '<div class="col-md-3 d-flex align-items-center"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" role="switch" id="sf-is_verified"' + (x.is_verified ? ' checked' : '') + '><label class="form-check-label" for="sf-is_verified">' + U.esc(T('as.isVerified', 'Checked against official source')) + '</label></div></div></div>';
    U.$('#add-crit').onclick = function () { U.$('#crit-rows').insertAdjacentHTML('beforeend', critRow({ group: 1, type: 'AGE', op: '>=' }, Date.now())); bindCrit(); };
    bindCrit(); U.$('#scheme-form').classList.remove('was-validated'); modal.show();
  }
  function bindCrit() { U.$$('[data-rmcrit]').forEach(function (b) { b.onclick = function () { b.closest('[data-crit]').remove(); }; }); }
  U.$('#scheme-form').addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target; f.classList.add('was-validated');
    var slug = U.$('#sf-slug'); slug.setCustomValidity(d.schemes.some(function (x) { return x.slug === slug.value && x !== editing; }) ? 'dup' : '');
    if (!f.checkValidity()) { var bad = f.querySelector(':invalid'); if (bad) bad.focus(); return; }
    var v = function (id) { return U.$('#' + id).value.trim(); };
    var obj = { name_en: v('sf-name_en'), name_ta: v('sf-name_ta'), slug: v('sf-slug'), category_id: Number(v('sf-cat')), level: v('sf-level'), state: v('sf-level') === 'STATE' ? (v('sf-state') || 'Tamil Nadu') : null,
      short_en: v('sf-short_en'), short_ta: v('sf-short_ta'), who_en: v('sf-who'), benefits_en: v('sf-benefits').split('\n').map(function (x) { return x.trim(); }).filter(Boolean),
      criteria: U.$$('[data-crit]').map(function (r) { var o = {}; U.$$('[data-k]', r).forEach(function (i) { o[i.getAttribute('data-k')] = i.value; }); o.group = Number(o.group) || 1; o.label_ta = ''; return o; }),
      documents: U.$$('[data-doc]:checked').map(function (c) { var id = c.getAttribute('data-doc'); return { id: id, mandatory: U.$('[data-mand="' + id + '"]').value === '1' }; }),
      official_url: v('sf-official'), source_name: v('sf-source_name'), source_url: v('sf-source_url'), last_verified_on: v('sf-verified_on'), is_verified: U.$('#sf-is_verified').checked };
    if (editing) { obj.id = editing.id; obj.aliases = editing.aliases; obj.image = editing.image; obj.is_active = editing.is_active; }
    else { obj.aliases = [obj.slug.replace(/-/g, ' ')]; obj.image = S.category(obj.category_id).slug; obj.is_active = true; }
    S.upsert('schemes', obj); CC.bot.rebuild(); modal.hide(); draw(); U.toast(T('as.savedMsg', 'Scheme saved'), 'success');
  });
  U.$('#add-btn').addEventListener('click', function () { openForm(null); });
  U.$('#as-q').addEventListener('input', function () { pageNo = 1; draw(); });
  U.$('#as-status').addEventListener('change', function () { pageNo = 1; draw(); });
  draw();
  if (U.param('edit')) openForm(S.scheme(U.param('edit')));
})();
