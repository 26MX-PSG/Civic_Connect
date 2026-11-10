// Same normalisation as store.js norm(): lower-case, strip punctuation, keep letters/marks/digits (Tamil safe)
function norm(s) {
  return String(s || '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
module.exports = { norm };
