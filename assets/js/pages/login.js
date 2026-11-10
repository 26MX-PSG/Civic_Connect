/* Login / Register */
(function () {
  var U = CC.ui, T = CC.i18n.t, S = CC.store;
  U.$('#auth-art').insertAdjacentHTML('afterbegin', U.img('hero', 'auth', ''));
  var next = U.param('next') || '', reason = U.param('reason');
  function go(u) {
    if (u.role === 'ADMIN' && (!next || !/^admin\//.test(next))) return location.href = 'admin/index.html';
    if (next && !/^(https?:)?\/\//.test(next)) return location.href = next;
    location.href = S.profile(u.id) ? 'dashboard.html' : 'profile.html';
  }
  if (S.currentUser() && !reason) go(S.currentUser());
  if (reason) U.$('#auth-reason').innerHTML = '<div class="warn-box mb-3"><i class="bi bi-info-circle" aria-hidden="true"></i><span>' +
    U.esc(reason === 'admin' ? T('auth.needAdmin', 'Please log in with an admin account to continue.') : reason === 'save' ? T('auth.needSave', 'Log in to save schemes and track your documents.') : T('auth.needLogin', 'Please log in to continue.')) + '</span></div>';
  if (U.param('tab') === 'register') bootstrap.Tab.getOrCreateInstance(U.$('#tab-register')).show();

  U.$$('[data-toggle-pass]').forEach(function (b) {
    b.addEventListener('click', function () {
      var i = U.$('#' + b.getAttribute('data-toggle-pass')); var show = i.type === 'password'; i.type = show ? 'text' : 'password';
      b.innerHTML = '<i class="bi ' + (show ? 'bi-eye-slash' : 'bi-eye') + '" aria-hidden="true"></i>'; b.setAttribute('aria-label', show ? T('auth.hide', 'Hide password') : T('auth.show', 'Show password'));
    });
  });
  function busy(btn, on) { btn.disabled = on; if (on) { btn.dataset.html = btn.innerHTML; btn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span>' + U.esc(T('common.wait', 'Please wait…')) + '</span>'; } else btn.innerHTML = btn.dataset.html; }

  U.$('#login-form').addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target, err = U.$('#login-error'); err.classList.add('d-none');
    f.classList.add('was-validated'); if (!f.checkValidity()) return;
    var btn = f.querySelector('[type=submit]'); busy(btn, true);
    setTimeout(function () {
      var r = S.login(U.$('#l-email').value, U.$('#l-pass').value); busy(btn, false);
      if (!r.ok) { err.textContent = r.error === 'disabled' ? T('auth.disabled', 'This account has been disabled. Contact the CivicConnect team.') : T('auth.wrong', 'Incorrect email or password.'); err.classList.remove('d-none'); err.focus && err.setAttribute('tabindex', '-1'); err.focus(); return; }
      go(r.user);
    }, 400);
  });
  var p1 = U.$('#r-pass');
  p1.addEventListener('input', function () {
    var v = p1.value, sc = (v.length >= 8) + /\d/.test(v) + /[A-Z]/.test(v) + /[^A-Za-z0-9]/.test(v);
    U.$('#pass-meter').style.width = (sc * 25) + '%';
    U.$('#pass-meter').style.background = sc < 2 ? 'var(--cc-error)' : sc < 3 ? 'var(--cc-warning)' : 'var(--cc-success)';
    U.$('#pass-label').textContent = !v ? T('auth.passHint', 'At least 8 characters, with a number.') : sc < 2 ? T('auth.weak', 'Weak password') : sc < 3 ? T('auth.ok', 'Okay — add a capital letter or symbol') : T('auth.strong', 'Strong password');
  });
  U.$('#register-form').addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target, err = U.$('#register-error'); err.classList.add('d-none');
    var p2 = U.$('#r-pass2'); p2.setCustomValidity(p2.value && p2.value !== p1.value ? 'x' : '');
    f.classList.add('was-validated'); if (!f.checkValidity()) return;
    var btn = f.querySelector('[type=submit]'); busy(btn, true);
    setTimeout(function () {
      var r = S.register(U.$('#r-name').value, U.$('#r-email').value, p1.value); busy(btn, false);
      if (!r.ok) { err.textContent = T('auth.exists', 'An account with this email already exists. Try logging in.'); err.classList.remove('d-none'); return; }
      location.href = 'profile.html?welcome=1';
    }, 400);
  });
  U.$('#forgot').addEventListener('click', function (e) { e.preventDefault(); U.toast(T('auth.forgotMsg', 'Password reset is handled by the backend (email link). Not available in this demo.')); });
  U.$$('[data-demo]').forEach(function (b) {
    b.addEventListener('click', function () {
      var admin = b.getAttribute('data-demo') === 'admin';
      var r = S.login(admin ? 'admin@demo.in' : 'citizen@demo.in', admin ? 'admin123' : 'demo123'); if (r.ok) go(r.user);
    });
  });
})();
