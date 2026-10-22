/* Categories */
(function () {
  var U = CC.ui;
  var g = U.$('#cat-grid');
  g.innerHTML = U.skeletonCards(8).replace(/class="col"/g, 'class="col"');
  CC.api('categories').then(function (cats) {
    g.innerHTML = cats.length ? cats.map(function (c) { return '<div class="col">' + U.catTile(c) + '</div>'; }).join('')
      : '<div class="col-12">' + U.empty('grid', CC.i18n.t('cats.empty', 'No categories yet'), CC.i18n.t('cats.emptyT', 'Categories appear here once schemes are added.')) + '</div>';
  }).catch(function () { g.innerHTML = '<div class="col-12">' + U.errorState('retry') + '</div>'; U.$('#retry').onclick = function () { location.reload(); }; });
})();
