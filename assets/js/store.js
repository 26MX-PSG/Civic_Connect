/* CivicConnect — mock REST layer.
 * Every function here mirrors an endpoint from the Team 2 API table
 * (e.g. CC.api.schemes() ≈ GET /api/schemes?keyword=&category=&state=).
 * Data lives in localStorage so the UI works with no server.
 * To connect the real Express API later, replace the body of each
 * function with a fetch() call and keep the same return shape.
 */
window.CC = window.CC || {};

CC.store = (function () {
  var KEY = 'cc_db_v3';
  var SESSION = 'cc_session';
  var mem = null;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: keep in memory */ } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function db() {
    if (mem) return mem;
    var raw = get(KEY);
    if (raw) { try { mem = JSON.parse(raw); return mem; } catch (e) {} }
    mem = clone(CC.seed);
    save();
    return mem;
  }
  function save() { set(KEY, JSON.stringify(mem)); }
  function reset() { mem = clone(CC.seed); save(); }

  /* ---------- text helpers ---------- */
  function norm(s) { return String(s || '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim(); }
  var SEARCH_STOP = { the: 1, a: 1, an: 1, for: 1, of: 1, to: 1, in: 1, and: 1, scheme: 1, schemes: 1, yojana: 1, me: 1, my: 1, is: 1, with: 1, on: 1, திட்டம்: 1 };

  /* ---------- categories ---------- */
  function categories(opts) {
    opts = opts || {};
    var d = db();
    return d.categories.filter(function (c) { return opts.all || c.is_active; }).map(function (c) {
      var n = d.schemes.filter(function (s) { return s.category_id === c.id && s.is_active; }).length;
      return Object.assign({}, c, { scheme_count: n });
    }).filter(function (c) { return opts.all || c.scheme_count > 0; });
  }
  function category(idOrSlug) {
    return db().categories.find(function (c) { return c.id == idOrSlug || c.slug === idOrSlug; }) || null;
  }

  /* ---------- schemes ---------- */
  function schemeText(s) {
    var c = category(s.category_id) || {};
    return norm([s.name_en, s.name_ta, (s.aliases || []).join(' '), s.short_en, s.short_ta, s.who_en, (s.benefits_en || []).join(' '), c.name_en, c.name_ta,
      s.documents.map(function (x) { var d = doc(x.id); return d ? d.name_en + ' ' + d.name_ta : ''; }).join(' ')].join(' '));
  }
  /* GET /api/schemes?keyword=&category=&level=&state= — logs no-result keyword searches in the same call */
  function schemes(q) {
    q = q || {};
    var list = db().schemes.filter(function (s) { return q.includeInactive || s.is_active; });
    if (q.category && q.category.length) {
      var cats = [].concat(q.category).map(function (x) { var c = category(x); return c ? c.id : -1; });
      list = list.filter(function (s) { return cats.indexOf(s.category_id) > -1; });
    }
    if (q.level) list = list.filter(function (s) { return s.level === q.level; });
    if (q.state) list = list.filter(function (s) { return !s.state || s.state === q.state; });
    var kw = norm(q.keyword).slice(0, 255);
    if (kw) {
      var terms = kw.split(' ').filter(function (t) { return t && !SEARCH_STOP[t]; });
      if (!terms.length) terms = [kw];
      list = list.map(function (s) {
        var text = schemeText(s), name = norm(s.name_en + ' ' + s.name_ta + ' ' + (s.aliases || []).join(' '));
        var hits = 0, score = 0;
        terms.forEach(function (t) {
          var stem = t.length > 4 ? t.replace(/(ies|es|s)$/, '') : t;
          if (text.indexOf(stem) > -1) { hits++; score += name.indexOf(stem) > -1 ? 3 : 1; }
        });
        return { s: s, hits: hits, score: score };
      }).filter(function (x) { return x.hits === terms.length || (terms.length > 2 && x.hits >= terms.length - 1); })
        .sort(function (a, b) { return b.score - a.score; }).map(function (x) { return x.s; });
      if (!list.length && !q.noLog) logQuery(q.keyword, 'SEARCH');
    }
    return list;
  }
  function scheme(idOrSlug) {
    var s = db().schemes.find(function (x) { return x.id == idOrSlug || x.slug === idOrSlug; });
    if (!s && CC.seed && CC.seed.schemes) {
      s = CC.seed.schemes.find(function (x) { return x.id == idOrSlug || x.slug === idOrSlug; });
    }
    return s || null;
  }
  function doc(id) { return db().documents.find(function (d) { return d.id === id; }) || null; }

  /* ---------- FAQs ---------- */
  function faqs(q) {
    q = q || {};
    var list = db().faqs.filter(function (f) { return q.all || f.is_active !== false; });
    if (q.topic) list = list.filter(function (f) { return f.topic === q.topic; });
    var kw = norm(q.keyword);
    if (kw) {
      var terms = kw.split(' ').filter(function (t) { return t.length > 2; });
      list = list.filter(function (f) {
        var t = norm(f.q_en + ' ' + f.a_en + ' ' + (f.q_ta || '') + ' ' + (f.a_ta || ''));
        return terms.every(function (x) { return t.indexOf(x.replace(/s$/, '')) > -1; });
      });
    }
    return list;
  }

  /* ---------- auth ---------- */
  function session() { try { return JSON.parse(get(SESSION) || 'null'); } catch (e) { return null; } }
  function currentUser() {
    var s = session(); if (!s) return null;
    return db().users.find(function (u) { return u.id === s.userId && u.is_active; }) || null;
  }
  function login(email, password) {
    var u = db().users.find(function (x) { return x.email.toLowerCase() === String(email).trim().toLowerCase(); });
    if (!u || u.password !== password) return { ok: false, error: 'invalid' };
    if (!u.is_active) return { ok: false, error: 'disabled' };
    set(SESSION, JSON.stringify({ userId: u.id, role: u.role }));
    return { ok: true, user: u };
  }
  function register(name, email, password) {
    var d = db();
    if (d.users.some(function (x) { return x.email.toLowerCase() === email.trim().toLowerCase(); })) return { ok: false, error: 'exists' };
    var u = { id: Math.max.apply(null, d.users.map(function (x) { return x.id; })) + 1, name: name.trim(), email: email.trim(), password: password,
      role: 'USER', preferred_language: (CC.i18n && CC.i18n.lang === 'ta') ? 'TA' : 'EN', email_notifications: false, is_active: true, created_at: new Date().toISOString().slice(0, 10) };
    d.users.push(u); save();
    set(SESSION, JSON.stringify({ userId: u.id, role: u.role }));
    return { ok: true, user: u };
  }
  function logout() { del(SESSION); }

  /* ---------- profile ---------- */
  function profile(uid) { return (db().profiles || {})[uid] || null; }
  function saveProfile(uid, p) { var d = db(); d.profiles = d.profiles || {}; d.profiles[uid] = p; save(); }

  /* ---------- saved ---------- */
  function saved(uid) { return ((db().saved || {})[uid] || []).slice(); }
  function isSaved(uid, sid) { return saved(uid).indexOf(Number(sid)) > -1; }
  function toggleSave(uid, sid) {
    var d = db(); d.saved = d.saved || {}; var arr = d.saved[uid] || (d.saved[uid] = []);
    sid = Number(sid); var i = arr.indexOf(sid);
    if (i > -1) arr.splice(i, 1); else arr.push(sid);
    save(); return i === -1;
  }

  /* ---------- document checklist (browser only, per user + scheme) ---------- */
  function ckKey(sid) { var u = currentUser(); return 'cc_check_' + (u ? u.id : 'guest') + '_' + sid; }
  function checklist(sid) { try { return JSON.parse(get(ckKey(sid)) || '[]'); } catch (e) { return []; } }
  function setChecklist(sid, ids) { set(ckKey(sid), JSON.stringify(ids)); }

  /* ---------- feedback ---------- */
  function giveFeedback(sid, useful, comment) {
    var d = db(); var f = d.feedback.find(function (x) { return x.scheme_id == sid; });
    if (!f) { f = { scheme_id: Number(sid), yes: 0, no: 0, comments: [] }; d.feedback.push(f); }
    var voteKey = 'cc_vote_' + (currentUser() ? currentUser().id : 'guest') + '_' + sid;
    var prev = get(voteKey);
    if (prev === 'yes') f.yes--; if (prev === 'no') f.no--;
    if (useful) f.yes++; else f.no++;
    set(voteKey, useful ? 'yes' : 'no');
    if (comment) f.comments.push(String(comment).slice(0, 200));
    save();
  }

  /* ---------- unanswered queries (search + chatbots) ---------- */
  function logQuery(text, source, schemeId) {
    text = String(text || '').trim().slice(0, 255); if (!text) return;
    var d = db(); var u = currentUser();
    var ex = d.queries.find(function (q) { return norm(q.query_text) === norm(text) && q.source === source; });
    if (ex) { ex.count = (ex.count || 1) + 1; ex.created_at = new Date().toISOString(); }
    else d.queries.unshift({ id: Date.now(), user_id: u ? u.id : null, query_text: text, source: source, scheme_id: schemeId || null,
      result_found: false, review_status: 'NEW', created_at: new Date().toISOString(), count: 1 });
    save();
  }

  /* ---------- notifications ---------- */
  function notifications(uid) { return db().notifications.filter(function (n) { return n.user_id === uid; }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }); }
  function markRead(id) { var n = db().notifications.find(function (x) { return x.id === id; }); if (n) { n.is_read = true; save(); } }

  /* ---------- admin ---------- */
  function upsert(listName, obj) {
    var d = db(); var list = d[listName];
    if (obj.id) { var i = list.findIndex(function (x) { return x.id == obj.id; }); if (i > -1) { list[i] = Object.assign(list[i], obj); save(); return list[i]; } }
    obj.id = Math.max.apply(null, list.map(function (x) { return Number(x.id) || 0; }).concat([0])) + 1;
    list.push(obj); save(); return obj;
  }
  function stats() {
    var d = db();
    var yes = d.feedback.reduce(function (a, f) { return a + f.yes; }, 0), no = d.feedback.reduce(function (a, f) { return a + f.no; }, 0);
    return {
      activeSchemes: d.schemes.filter(function (s) { return s.is_active; }).length, totalSchemes: d.schemes.length,
      users: d.users.filter(function (u) { return u.role === 'USER'; }).length,
      newQueries: d.queries.filter(function (q) { return q.review_status === 'NEW'; }).length,
      chatbotQueries: d.queries.filter(function (q) { return /CHATBOT/.test(q.source); }).length,
      usefulPct: yes + no ? Math.round(yes * 100 / (yes + no)) : 0, responses: yes + no
    };
  }

  return {
    db: db, save: save, reset: reset, norm: norm,
    categories: categories, category: category, schemes: schemes, scheme: scheme, doc: doc, faqs: faqs,
    session: session, currentUser: currentUser, login: login, register: register, logout: logout,
    profile: profile, saveProfile: saveProfile, saved: saved, isSaved: isSaved, toggleSave: toggleSave,
    checklist: checklist, setChecklist: setChecklist, giveFeedback: giveFeedback, logQuery: logQuery,
    notifications: notifications, markRead: markRead, upsert: upsert, stats: stats
  };
})();

/* Promise wrapper with a short delay so loading skeletons are visible, like a real API. */
CC.api = function (fn) {
  var args = [].slice.call(arguments, 1);
  return new Promise(function (resolve, reject) {
    setTimeout(function () { try { resolve(CC.store[fn].apply(null, args)); } catch (e) { reject(e); } }, 220);
  });
};
