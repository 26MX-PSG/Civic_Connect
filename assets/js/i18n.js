/* CivicConnect — English / Tamil switching.
 * English text lives in the HTML (and as fallbacks in JS). Tamil strings live in lang/ta.js.
 * Markup:  data-i18n="key" (text) · data-i18n-ph="key" (placeholder) · data-i18n-aria="key" (aria-label)
 * JS:      CC.i18n.t('key', 'English fallback')
 */
window.CC = window.CC || {};
CC.TA = CC.TA || {};
CC.i18n = (function () {
  var lang = 'en';
  try { lang = localStorage.getItem('cc_lang') || 'en'; } catch (e) {}
  if (lang !== 'ta') lang = 'en';
  document.documentElement.lang = lang;

  function t(key, en) { return lang === 'ta' && CC.TA[key] ? CC.TA[key] : en; }
  function apply(root) {
    if (lang !== 'ta') return;
    (root || document).querySelectorAll('[data-i18n]').forEach(function (el) { var v = CC.TA[el.getAttribute('data-i18n')]; if (v) el.textContent = v; });
    (root || document).querySelectorAll('[data-i18n-ph]').forEach(function (el) { var v = CC.TA[el.getAttribute('data-i18n-ph')]; if (v) el.setAttribute('placeholder', v); });
    (root || document).querySelectorAll('[data-i18n-aria]').forEach(function (el) { var v = CC.TA[el.getAttribute('data-i18n-aria')]; if (v) el.setAttribute('aria-label', v); });
    var tt = document.querySelector('title[data-i18n-title]'); if (tt && CC.TA[tt.getAttribute('data-i18n-title')]) document.title = CC.TA[tt.getAttribute('data-i18n-title')] + ' · CivicConnect';
  }
  function set(l) { try { localStorage.setItem('cc_lang', l); } catch (e) {} location.reload(); }
  return { lang: lang, t: t, apply: apply, set: set };
})();
