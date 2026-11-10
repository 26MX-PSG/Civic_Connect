/* Saved schemes with document progress + undo */
(function () {
  var U = CC.ui, T = CC.i18n.t, S = CC.store;
  var u = U.requireLogin(); if (!u) return;
  var box = U.$('#saved-list');
  function draw() {
    var ids = S.saved(u.id);
    if (!ids.length) { box.innerHTML = '<div class="col-12"><div class="panel">' + U.empty('bookmark', T('saved.empty', 'You haven’t saved any schemes yet'), T('saved.emptyT', 'Tap the bookmark on any scheme to keep it here with your document checklist.'), '<a class="btn btn-primary" href="schemes.html">' + U.esc(T('saved.browse', 'Browse schemes')) + '</a>') + '</div></div>'; return; }
    box.innerHTML = ids.map(function (id) {
      var s = S.scheme(id); if (!s) return '';
      var done = S.checklist(s.id).length;
      return '<div class="col">' + U.schemeCard(s, { progress: { done: Math.min(done, s.documents.length), total: s.documents.length }, remove: true }) + '</div>';
    }).join('');
    U.bindSave(box, function () { draw(); });
    U.$$('[data-remove]', box).forEach(function (b) { b.addEventListener('click', function (e) {
      e.stopPropagation(); var id = b.getAttribute('data-remove'); S.toggleSave(u.id, id); draw();
      U.toast(T('toast.unsaved', 'Removed from saved'), 'success', { label: T('common.undo', 'Undo'), fn: function () { S.toggleSave(u.id, id); draw(); } });
    }); });
  }
  box.innerHTML = U.skeletonCards(3);
  setTimeout(draw, 200);
})();
