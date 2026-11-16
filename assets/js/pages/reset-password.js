(function () {
  var U = CC.ui;
  U.$('#auth-art').insertAdjacentHTML('afterbegin', U.img('hero', 'auth', ''));

  var token = new URLSearchParams(window.location.search).get('token') || '';
  var form = U.$('#reset-form');
  var msg = U.$('#reset-message');
  var pass = U.$('#rp-pass');
  var pass2 = U.$('#rp-pass2');

  function showMessage(type, text) {
    msg.className = 'alert ' + (type === 'error' ? 'alert-danger' : 'alert-success');
    msg.textContent = text;
    msg.classList.remove('d-none');
    msg.setAttribute('tabindex', '-1');
    msg.focus();
  }

  if (!token) {
    showMessage('error', 'This password reset link is missing or invalid. Please request a new reset link.');
    form.querySelector('[type=submit]').disabled = true;
    pass.disabled = true;
    pass2.disabled = true;
    return;
  }

  pass2.addEventListener('input', function () {
    pass2.setCustomValidity(pass2.value && pass2.value !== pass.value ? 'Password mismatch' : '');
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    form.classList.add('was-validated');

    if (pass.value.length < 8) {
      showMessage('error', 'Use at least 8 characters for the new password.');
      return;
    }

    if (pass.value !== pass2.value) {
      pass2.setCustomValidity('Password mismatch');
      showMessage('error', 'Passwords do not match.');
      return;
    }

    var btn = form.querySelector('[type=submit]');
    var original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span> Updating…</span>';

    try {
      var response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token, password: pass.value })
      });
      var data = await response.json().catch(function () { return {}; });

      if (!response.ok) {
        throw new Error((data && data.error && data.error.message) || 'This reset link is invalid or expired.');
      }

      showMessage('success', data.message || 'Password updated successfully.');
      form.reset();
      form.classList.remove('was-validated');
      setTimeout(function () {
        window.location.href = 'login.html';
      }, 1400);
    } catch (err) {
      showMessage('error', err.message || 'Unable to update your password.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });
})();
