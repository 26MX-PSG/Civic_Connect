/* Citizen profile — 3-step form with conditional fields */
(function () {
  var U = CC.ui, T = CC.i18n.t, S = CC.store, E = CC.ENUMS;
  var u = U.requireLogin(); if (!u) return;
  var p = Object.assign({}, S.profile(u.id) || {});
  var step = 1, dirty = false;
  var STEP_OF = { dob: 1, gender: 1, income: 2, occupation: 2, student_level: 2, farmer_land_status: 2, state: 3, district: 3, disability_type: 3 };
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

  // fill
  U.$('#f-dob').value = p.dob || '';
  if (p.gender) U.$('#g-' + p.gender).checked = true;
  U.$('#f-income').value = p.income || ''; U.$('#f-occupation').value = p.occupation || '';
  U.$('#f-student_level').value = p.student_level || ''; U.$('#f-farmer_land_status').value = p.farmer_land_status || '';
  U.$('#f-state').value = p.state || ''; districts(); U.$('#f-district').value = p.district || '';
  if (p.disability_type === 'NONE') U.$('#d-NONE').checked = true; else if (p.disability_type) { U.$('#d-YES').checked = true; U.$('#f-disability_type').value = p.disability_type; }
  U.$('#f-email').checked = !!u.email_notifications;

  function read() {
    var g = U.$('input[name=gender]:checked'), d = U.$('input[name=hasdis]:checked');
    var occ = U.$('#f-occupation').value;
    return { dob: U.$('#f-dob').value, gender: g ? g.value : '', income: U.$('#f-income').value ? Number(U.$('#f-income').value) : '', occupation: occ,
      state: U.$('#f-state').value, district: U.$('#f-district').value,
      student_level: occ === 'STUDENT' || U.$('#f-student_level').value ? U.$('#f-student_level').value : '',
      farmer_land_status: occ === 'FARMER' || U.$('#f-farmer_land_status').value ? U.$('#f-farmer_land_status').value : '',
      disability_type: !d || d.value === 'SKIP' ? null : d.value === 'NONE' ? 'NONE' : (U.$('#f-disability_type').value || null) };
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
    var np = read(); var d = U.$('input[name=hasdis]:checked');
    if (d && d.value === 'YES' && !np.disability_type) { U.$('#f-disability_type').classList.add('is-invalid'); U.$('#f-disability_type').focus(); return; }
    S.saveProfile(u.id, np); u.email_notifications = U.$('#f-email').checked; S.save(); dirty = false;
    var n = CC.match.recommend(np).filter(function (x) { return x.result.status === 'MATCH'; }).length;
    U.toast(T('profile.saved', 'Profile saved') + ' — ' + n + ' ' + T('profile.matchCount', 'schemes match your details'), 'success', { label: T('profile.seeMatches', 'See matches'), fn: function () { location.href = 'recommendations.html'; } });
  });
  cond();
  if (U.param('welcome')) U.toast(T('profile.welcome', 'Account created. Tell us a little about you to see matching schemes.'), 'success');
  var h = location.hash.replace('#f-', ''); if (STEP_OF[h]) { show(STEP_OF[h]); setTimeout(function () { var el = U.$('#f-' + h) || U.$('#f-' + h + '_wrap'); if (el) { el.scrollIntoView({ block: 'center' }); (el.querySelector('input,select') || el).focus(); } }, 50); }
})();
