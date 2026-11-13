(function () {
  var U = CC.ui;
  U.$('#auth-art').insertAdjacentHTML('afterbegin', U.img('hero', 'auth', ''));

  var form = U.$('#forgot-form');
  var msg = U.$('#forgot-message');
  var emailInput = U.$('#fp-email');

  function showMessage(type, text) {
    msg.className = 'alert ' + (type === 'error' ? 'alert-danger' : 'alert-success');
    msg.textContent = text;
    msg.classList.remove('d-none');
    msg.setAttribute('tabindex', '-1');
    msg.focus();
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = emailInput.value.trim();
    form.classList.add('was-validated');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMessage('error', 'Please enter a valid email address.');
      return;
    }

    var btn = form.querySelector('[type=submit]');
    var original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span> Sending…</span>';

    try {
      var response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      });
      var data = await response.json().catch(function () { return {}; });

      if (!response.ok) {
        throw new Error((data && data.error && data.error.message) || 'Unable to process your request right now.');
      }

      showMessage('success', data.message || 'If an account exists for that email, a password reset link has been sent.');
      form.reset();
      form.classList.remove('was-validated');
    } catch (err) {
      showMessage('error', err.message || 'Unable to send the reset link.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });
})();
