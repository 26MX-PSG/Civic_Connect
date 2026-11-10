/* Home page */
(function () {
  var U = CC.ui, T = CC.i18n.t, S = CC.store;
  U.$('#hero-img').innerHTML = U.img('hero', 'hero', '', 'hero-img');
  // Find My Schemes → profile (or register first)
  var u = S.currentUser();
  U.$('#find-btn').href = u ? (S.profile(u.id) ? 'recommendations.html' : 'profile.html') : 'login.html?next=profile.html&tab=register';
  // empty search hint
  U.$('.hero-search').addEventListener('submit', function (e) {
    if (!U.$('#hero-q').value.trim()) { e.preventDefault(); U.$('#hero-hint').hidden = false; U.$('#hero-q').focus(); }
  });
  // categories (top 6 by scheme count)
  var cats = S.categories().sort(function (a, b) { return b.scheme_count - a.scheme_count; }).slice(0, 6);
  U.$('#home-cats').innerHTML = cats.map(function (c) { return '<div class="col">' + U.catCard(c) + '</div>'; }).join('');
  // featured
  U.$('#home-featured').innerHTML = ['pudhumai-penn', 'pm-kisan', 'pm-jay'].map(function (slug) {
    var s = S.scheme(slug);
    return '<a class="tile card" href="scheme.html?slug=' + s.slug + '"><span class="cat-icon"><i class="bi bi-' + S.category(s.category_id).icon + '" aria-hidden="true"></i></span><span><span class="fw-semibold d-block" style="color:var(--cc-primary)">' + U.esc(U.sName(s)) + '</span><span class="small text-muted">' + U.esc(U.sShort(s)) + '</span></span></a>';
  }).join('');
  // chatbot example chips
  var qs = [T('bot.gq1', 'Documents for PM-KISAN'), T('bot.gq2', 'Where can I get an income certificate?'), T('bot.gq5', 'Free bus travel for women'), T('bot.gq3', 'Schemes for farmers')];
  U.$('#home-bot-chips').innerHTML = qs.map(function (q) { return '<button type="button" class="chip" data-open-bot data-q="' + U.esc(q) + '"><i class="bi bi-chat-left-text" aria-hidden="true"></i>' + U.esc(q) + '</button>'; }).join('');
})();
