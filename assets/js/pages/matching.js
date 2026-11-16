/* Citizen profile — 3-step form with conditional fields */
(function () {
  var U = CC.ui, T = CC.i18n.t, S = CC.store, E = CC.ENUMS;
  var u = U.requireLogin(); if (!u) return;
  var p = Object.assign({}, S.profile(u.id) || {});
  var step = 1, dirty = false;
  var STEP_OF = { dob: 1, gender: 1, income: 2, occupation: 2, student_level: 2, farmer_land_status: 2, state: 3, district: 3, disability_type: 3, family_special_needs: 3 };
  var sel = T('common.select', 'Select…');

  function opts(id, values, labelFn) { U.$('#' + id).innerHTML = '<option value="">' + U.esc(sel) + '</option>' + values.map(function (v) { var x = typeof v === 'object' ? v : { value: v }; return '<option value="' + x.value + '">' + U.esc(labelFn(x)) + '</option>'; }).join(''); }
  opts('f-income', E.income_ranges, function (x) { return CC.i18n.lang === 'ta' ? x.ta : x.en; });
  opts('f-occupation', E.occupation, function (x) { return U.label(x.value); });
  opts('f-student_level', E.student_level, function (x) { return U.label(x.value); });
  opts('f-farmer_land_status', E.farmer_land_status, function (x) { return U.label(x.value); });
  opts('f-disability_type', E.disability_type, function (x) { return U.label(x.value); });
  opts('f-state', E.states, function (x) { return x.value; });
  function districts() { opts('f-district', E.districts[U.$('#f-state').value] || [], function (x) { return x.value; }); }
  U.$('#gender-group').innerHTML = E.gender.map(function (g) { return '<input type="radio" name="gender" id="g-' + g + '" value="' + g + '"><label for="g-' + g + '">' + U.esc(U.label(g)) + '</label>'; }).join('');
  U.$('#dis-group').innerHTML = [['YES', T('common.yes', 'Yes')], ['NONE', T('common.no', 'No')], ['SKIP', T('profile.skip', 'Prefer not to say')]].map(function (o) { return '<input type="radio" name="hasdis" id="d-' + o[0] + '" value="' + o[0] + '"><label for="d-' + o[0] + '">' + U.esc(o[1]) + '</label>'; }).join('');
  U.$('#family-needs-group').innerHTML = [['YES', T('common.yes', 'Yes')], ['NO', T('common.no', 'No')]].map(function (o) { return '<input type="radio" name="hasfamilyneeds" id="family-' + o[0] + '" value="' + o[0] + '"><label for="family-' + o[0] + '">' + U.esc(o[1]) + '</label>'; }).join('');

  // fill
  U.$('#f-dob').value = p.dob || '';
  if (p.gender) U.$('#g-' + p.gender).checked = true;
  U.$('#f-income').value = p.income || ''; U.$('#f-occupation').value = p.occupation || '';
  U.$('#f-student_level').value = p.student_level || ''; U.$('#f-farmer_land_status').value = p.farmer_land_status || '';
  U.$('#f-state').value = p.state || ''; districts(); U.$('#f-district').value = p.district || '';
  if (p.disability_type === 'NONE') U.$('#d-NONE').checked = true; else if (p.disability_type) { U.$('#d-YES').checked = true; U.$('#f-disability_type').value = p.disability_type; }
  if (p.family_special_needs === 'YES') U.$('#family-YES').checked = true; else if (p.family_special_needs === 'NO') U.$('#family-NO').checked = true;
  U.$('#f-email').checked = !!u.email_notifications;

  function read() {
    var g = U.$('input[name=gender]:checked'), d = U.$('input[name=hasdis]:checked'), f = U.$('input[name=hasfamilyneeds]:checked');
    var occ = U.$('#f-occupation').value;
    return { dob: U.$('#f-dob').value, gender: g ? g.value : '', income: U.$('#f-income').value ? Number(U.$('#f-income').value) : '', occupation: occ,
      state: U.$('#f-state').value, district: U.$('#f-district').value,
      student_level: occ === 'STUDENT' || U.$('#f-student_level').value ? U.$('#f-student_level').value : '',
      farmer_land_status: occ === 'FARMER' || U.$('#f-farmer_land_status').value ? U.$('#f-farmer_land_status').value : '',
      disability_type: !d || d.value === 'SKIP' ? null : d.value === 'NONE' ? 'NONE' : (U.$('#f-disability_type').value || null),
      family_special_needs: f ? f.value : null };
  }
  function cond() {
    var occ = U.$('#f-occupation').value, d = U.$('input[name=hasdis]:checked');
    U.$('#wrap-student').hidden = occ !== 'STUDENT'; U.$('#wrap-farmer').hidden = occ !== 'FARMER';
    U.$('#wrap-dis').hidden = !(d && d.value === 'YES');
    var pc = CC.match.completion(read()); U.$('#ring').style.setProperty('--p', pc); U.$('#ring-num').textContent = pc + '%';
  }
  function show(n) {
    step = n;
    U.$$('fieldset[data-step]').forEach(function (f) { f.hidden = Number(f.getAttribute('data-step')) !== n; });
    U.$$('#stepper li').forEach(function (li) { var s = Number(li.getAttribute('data-step')); li.className = s < n ? 'done' : s === n ? 'current' : ''; if (s === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    U.$('#back-btn').hidden = n === 1; U.$('#next-btn').hidden = n === 3; U.$('#save-btn').hidden = n !== 3;
    var first = U.$('fieldset[data-step="' + n + '"] legend'); if (first) { first.setAttribute('tabindex', '-1'); first.focus(); }
  }
  U.$('#profile-form').addEventListener('change', function (e) { dirty = true; if (e.target.id === 'f-state') districts(); cond(); });
  U.$('#next-btn').addEventListener('click', function () {
    var dob = U.$('#f-dob'); if (step === 1 && dob.value && new Date(dob.value) > new Date()) { dob.classList.add('is-invalid'); return; }
    dob.classList.remove('is-invalid'); show(step + 1);
  });
  U.$('#back-btn').addEventListener('click', function () { show(step - 1); });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  U.$('#profile-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var np = read(); var d = U.$('input[name=hasdis]:checked'); var f = U.$('input[name=hasfamilyneeds]:checked');
    if (d && d.value === 'YES' && !np.disability_type) { U.$('#f-disability_type').classList.add('is-invalid'); U.$('#f-disability_type').focus(); return; }
    if (!f) { U.$('#family-needs-group').classList.add('is-invalid'); U.$('#family-YES').focus(); return; }
    U.$('#family-needs-group').classList.remove('is-invalid');
    S.saveProfile(u.id, np); u.email_notifications = U.$('#f-email').checked; S.save(); dirty = false; renderResults();
    var n = CC.match.recommend(np).filter(function (x) { return x.result.status === 'MATCH'; }).length;
    U.toast(T('profile.saved', 'Profile saved') + ' — ' + n + ' ' + T('profile.matchCount', 'schemes match your details'), 'success', { label: T('profile.seeMatches', 'See matches'), fn: function () { U.$('#results').scrollIntoView({ behavior: 'smooth' }); } });
  });
  cond();
  function renderResults() {
    var root = U.$('#rec-root'), pr = S.profile(u.id);
    if (!pr) { root.innerHTML = '<div class="panel">' + U.empty('person-vcard', T('rec.noProfile', 'Tell us about yourself first'), T('rec.noProfileT', 'Fill in the details above and save to see schemes whose basic criteria match.')) + '</div>'; return; }
    var recs = CC.match.recommend(pr);
    var full = recs.filter(function (r) { return r.result.status === 'MATCH'; }), part = recs.filter(function (r) { return r.result.status === 'PARTIAL'; });
    if (!recs.length) { root.innerHTML = '<div class="panel">' + U.empty('search', T('rec.none', 'No matches yet'), T('rec.noneT', 'Try completing more of your profile, or browse all 15 schemes.'), '<a class="btn btn-primary" href="schemes.html">' + U.esc(T('home.browse', 'Browse All 15')) + '</a>') + '</div>'; return; }
    function group(list, title, icon, sub) {
      if (!list.length) return '';
      return '<section class="mb-5"><h3 class="h4 d-flex align-items-center gap-2"><i class="bi bi-' + icon + '" aria-hidden="true"></i>' + U.esc(title) + ' <span class="badge-cc b-cat">' + list.length + '</span></h3><p class="text-muted small">' + U.esc(sub) + '</p><div class="row row-cols-1 row-cols-md-2 g-3">' +
        list.map(function (r) { return '<div class="col">' + U.schemeCard(r.scheme, { result: r.result }) + '</div>'; }).join('') + '</div></section>';
    }
    root.innerHTML = group(full, T('match.basic', 'Basic Criteria Match'), 'check-circle', T('rec.fullSub', 'Your profile meets the basic criteria we have recorded for these schemes.')) +
      group(part, T('match.partial', 'Partial match – complete your profile'), 'question-circle', T('rec.partSub', 'Some details these schemes need are missing. Add them above to get a clearer result.'));
    U.bindSave(root);
  }
  renderResults();
  if (location.hash === '#results') { /* scroll handled by browser */ }
  var h = location.hash.replace('#f-', ''); if (STEP_OF[h]) { show(STEP_OF[h]); setTimeout(function () { var el = U.$('#f-' + h) || U.$('#f-' + h + '_wrap'); if (el) { el.scrollIntoView({ block: 'center' }); (el.querySelector('input,select') || el).focus(); } }, 50); }
})();
