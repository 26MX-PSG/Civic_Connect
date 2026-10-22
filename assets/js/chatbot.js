/* CivicConnect — FAQ & Scheme chatbots (keyword-based, no AI service).
 *
 * Pipeline for every question:
 *   1. normalise   – lowercase, strip punctuation (keeps Tamil letters)
 *   2. tokenise    – split into words
 *   3. stop words  – drop filler words (English + Tamil)
 *   4. stem        – documents → document, matching → match
 *   5. concepts    – map synonyms to one keyword (crop, agriculture, விவசாயம் → farmer)
 *   6. entities    – detect scheme names and document names
 *   7. intent      – documents / eligibility / benefits / apply / where-to-get / source / overview
 *   8. retrieve    – score CivicConnect's own knowledge (FAQs, scheme sections, document guide)
 *   9. answer      – reply + detected keywords + SOURCE (which page / section / official site)
 *  10. fallback    – nothing scored high enough → say so honestly and log it for admin review
 *
 * Two modes share this engine:
 *   - General assistant (scope 'general'): floating button on every citizen page
 *   - Scheme assistant  (scope 'scheme') : on the scheme details page, answers about that scheme only
 */
window.CC = window.CC || {};

CC.bot = (function () {
  var S = function () { return CC.store; };
  var T = function (k, en) { return CC.i18n ? CC.i18n.t(k, en) : en; };
  var isTa = function () { return CC.i18n && CC.i18n.lang === 'ta'; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  /* ---------- 1–4: text processing ---------- */
  var STOP = {};
  ('a an the is are am was were be been being i me my mine we our you your he she it they them their this that these those to of in on for ' +
   'with at by from about as into like through over after before under and or but if then so than too very can could should would will shall ' +
   'may might must do does did done have has had having which who whom whose please tell know want wanted need needs get got give show any ' +
   'some there here also just only not no yes ok okay im its am pls plz let us want scheme schemes yojana info information details detail ' +
   'regarding something anything kindly sir madam what where how why when does doe there is mean meaning explain tell')
    .split(' ').forEach(function (w) { STOP[w] = 1; });
  ['என்ன', 'எப்படி', 'ஏன்', 'எது', 'எந்த', 'ஒரு', 'இந்த', 'அந்த', 'நான்', 'எனக்கு', 'என்', 'உள்ளது', 'இருக்கிறது', 'வேண்டும்', 'பற்றி',
   'மற்றும்', 'அல்லது', 'தான்', 'கூட', 'என்று', 'இருந்தால்', 'செய்ய', 'எவ்வளவு', 'திட்டம்', 'திட்டத்தில்', 'திட்டத்துக்கு', 'திட்டத்திற்கு', 'சொல்லுங்கள்', 'தேவை']
    .forEach(function (w) { STOP[w] = 1; });

  function normalise(s) { return String(s || '').toLowerCase().replace(/[’'`]/g, '').replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim(); }
  function isTamil(w) { return /[஀-௿]/.test(w); }
  function stem(w) {
    if (isTamil(w) || w.length < 4) return w;
    if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (/ing$/.test(w) && w.length > 5) return w.slice(0, -3);
    if (/ed$/.test(w) && w.length > 4) return w.slice(0, -2);
    if (/(ses|xes|ches|shes)$/.test(w)) return w.slice(0, -2);
    if (/s$/.test(w) && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function tokens(text) { return normalise(text).split(' ').filter(Boolean); }
  function keyTokens(text) { return tokens(text).filter(function (w) { return !STOP[w] && w.length > 1; }).map(stem); }

  /* ---------- 5: concept (synonym) map ---------- */
  var CONCEPTS = {
    farmer: ['farmer', 'farming', 'farm', 'agriculture', 'agricultural', 'crop', 'cultivator', 'kisan', 'harvest', 'விவசா', 'பயிர்', 'உழவ'],
    student: ['student', 'study', 'studying', 'college', 'school', 'education', 'scholarship', 'degree', 'course', 'diploma', 'fee', 'மாணவ', 'கல்வி', 'படிப்', 'கல்லூரி', 'உதவித்தொகை'],
    women: ['woman', 'women', 'female', 'girl', 'lady', 'ladie', 'mother', 'wife', 'homemaker', 'பெண்', 'மகளிர்', 'மாணவி', 'தாய்'],
    health: ['health', 'hospital', 'medical', 'treatment', 'surgery', 'illness', 'doctor', 'disease', 'மருத்துவ', 'சிகிச்சை', 'சுகாதார', 'நோய்'],
    insurance: ['insurance', 'insure', 'bima', 'cover', 'காப்பீ'],
    senior: ['senior', 'old', 'elderly', 'aged', 'pension', 'retired', 'முதிய', 'ஓய்வூதி', 'வயதான'],
    job: ['job', 'employment', 'work', 'skill', 'training', 'career', 'placement', 'unemployed', 'internship', 'வேலை', 'திறன்', 'பயிற்சி'],
    loan: ['loan', 'credit', 'vendor', 'business', 'shop', 'capital', 'கடன்', 'வியாபார'],
    disability: ['disability', 'disabled', 'handicap', 'wheelchair', 'differently', 'pwd', 'udid', 'மாற்றுத்திறன்', 'ஊனம்'],
    autism: ['autism', 'autistic', 'cerebral', 'intellectual', 'special', 'ஆட்டிசம்'],
    bus: ['bus', 'travel', 'transport', 'ticket', 'pass', 'commute', 'பேருந்', 'பயண'],
    gas: ['gas', 'lpg', 'cylinder', 'cooking', 'எரிவாயு', 'சிலிண்டர்'],
    income: ['income', 'salary', 'earning', 'poor', 'bpl', 'வருமான', 'ஏழை'],
    esevai: ['esevai', 'sevai', 'இசேவை', 'சேவை'],
    match: ['match', 'matching', 'recommend', 'recommendation', 'suit', 'suitable', 'பொருத்த'],
    language: ['language', 'tamil', 'english', 'translate', 'மொழி', 'தமிழ்'],
    save: ['save', 'bookmark', 'saved', 'சேமி'],
    privacy: ['privacy', 'private', 'admin', 'safe', 'data', 'தனியுரிமை'],
    upload: ['upload', 'copy', 'scan', 'பதிவேற்ற']
  };
  /* concepts → category slug, used to suggest schemes by topic */
  var CONCEPT_CATEGORY = { farmer: 'farmers', student: 'education', women: 'women-welfare', health: 'healthcare', insurance: 'healthcare', senior: 'senior-citizens',
    job: 'employment-skills', loan: 'financial-support', disability: 'differently-abled', autism: 'autism-special-needs', bus: 'transport', gas: 'women-welfare' };

  /* ---------- 7: intents ---------- */
  var INTENTS = [
    { id: 'where_get', label: ['Where to get a document', 'ஆவணம் எங்கே பெறுவது'], words: ['where', 'obtain', 'issue', 'issued', 'office', 'centre', 'center', 'எங்கே', 'எங்கு', 'பெற', 'பெறுவது'] },
    { id: 'documents', label: ['Required documents', 'தேவையான ஆவணங்கள்'], words: ['document', 'docs', 'doc', 'paper', 'proof', 'required', 'need', 'bring', 'checklist', 'certificate', 'ஆவண', 'சான்று', 'சான்றிதழ்'] },
    { id: 'eligibility', label: ['Eligibility / criteria', 'தகுதி / நிபந்தனைகள்'], words: ['eligible', 'eligibility', 'criteria', 'criterion', 'qualify', 'condition', 'who', 'age', 'limit', 'allowed', 'தகுதி', 'யார்', 'வயது', 'நிபந்தனை'] },
    { id: 'benefits', label: ['Benefits', 'பயன்கள்'], words: ['benefit', 'amount', 'money', 'much', 'receive', 'payment', 'instalment', 'installment', 'cover', 'coverage', 'what get', 'பயன்', 'தொகை', 'பணம்', 'கிடைக்கும்'] },
    { id: 'apply', label: ['How to apply', 'எப்படி விண்ணப்பிப்பது'], words: ['apply', 'application', 'register', 'registration', 'enrol', 'enroll', 'portal', 'website', 'link', 'online', 'submit', 'விண்ணப்', 'இணையதள', 'பதிவு'] },
    { id: 'source', label: ['Source & last verified', 'மூலம் & சரிபார்ப்பு'], words: ['source', 'verified', 'updated', 'official', 'department', 'genuine', 'மூலம்', 'அதிகாரப்பூர்வ'] },
    { id: 'overview', label: ['Overview', 'கண்ணோட்டம்'], words: ['what', 'about', 'explain', 'summary', 'overview', 'meaning', 'mean', 'விளக்க', 'என்றால்'] }
  ];
  var GREET = ['hi', 'hello', 'hey', 'vanakkam', 'வணக்கம்', 'good morning', 'good evening'];
  var THANKS = ['thanks', 'thank', 'நன்றி'];

  /* ---------- 6: entity dictionaries ---------- */
  var DOC_WORDS = {
    aadhaar: ['aadhaar', 'aadhar', 'adhar', 'adhaar', 'ஆதார்'], ration_card: ['ration', 'family card', 'smart card', 'குடும்ப அட்டை', 'ரேஷன்'],
    income_certificate: ['income certificate', 'income proof', 'வருமானச் சான்று', 'வருமான சான்று', 'வருமானச் சான்றிதழ்', 'வருமான சான்றிதழ்'], community_certificate: ['community', 'caste', 'சாதி'],
    bank_passbook: ['bank', 'passbook', 'account', 'வங்கி'], land_records: ['patta', 'chitta', 'land record', 'land document', 'பட்டா', 'சிட்டா'],
    sowing_certificate: ['sowing', 'tenancy', 'vao', 'விதைப்பு'], age_proof: ['age proof', 'birth certificate', 'பிறப்புச் சான்று', 'பிறப்பு'],
    udid: ['udid', 'disability certificate', 'disability card', 'மாற்றுத்திறனாளி அட்டை', 'மாற்றுத்திறனாளி சான்று', 'மாற்றுத்திறனாளி சான்றிதழ்'], bonafide: ['bonafide', 'bona fide', 'admission certificate', 'study certificate'],
    mark_sheets: ['mark sheet', 'marksheet', 'marks', 'மதிப்பெண்'], photo: ['photo', 'photograph', 'புகைப்பட'], mobile: ['mobile', 'phone', 'otp', 'கைபேசி'],
    vendor_certificate: ['vending certificate', 'vendor certificate', 'letter of recommendation', 'வியாபாரச் சான்று']
  };

  function hasWord(qn, qt, w) {
    if (w.indexOf(' ') > -1) return qn.indexOf(w) > -1;
    if (isTamil(w)) return qt.some(function (t) { return t.indexOf(w) === 0; });
    return qt.indexOf(w) > -1 || qt.map(stem).indexOf(stem(w)) > -1;
  }

  function analyse(q, ctx) {
    var qn = normalise(q), qt = tokens(q);
    var kt = keyTokens(q);
    var concepts = [];
    Object.keys(CONCEPTS).forEach(function (k) { if (CONCEPTS[k].some(function (w) { return hasWord(qn, qt, w); })) concepts.push(k); });
    var schemesFound = [];
    S().schemes({ includeInactive: true }).forEach(function (s) {
      var names = (s.aliases || []).concat([s.slug.replace(/-/g, ' '), normalise(s.name_en)]);
      if (names.some(function (a) { a = normalise(a); return a.length > 2 && (' ' + qn + ' ').indexOf(' ' + a) > -1; })) schemesFound.push(s);
    });
    if (ctx && ctx.scheme && /\b(this|it)\b|இந்தத்|இதற்கு|இதில்/.test(qn) && schemesFound.indexOf(ctx.scheme) < 0) schemesFound.unshift(ctx.scheme);
    var docs = Object.keys(DOC_WORDS).filter(function (id) { return DOC_WORDS[id].some(function (w) { return hasWord(qn, qt, w); }); });
    if (docs.indexOf('income_certificate') > -1) concepts = concepts.filter(function (c) { return c !== 'income'; });
    var scores = INTENTS.map(function (it) { return { it: it, n: it.words.filter(function (w) { return hasWord(qn, qt, w); }).length }; });
    var best = scores.filter(function (x) { return x.n > 0; });
    var intent = null;
    if (best.length) {
      // "where" + a document name → where_get wins; otherwise the strongest intent (order breaks ties)
      if (docs.length && best.some(function (x) { return x.it.id === 'where_get'; })) intent = 'where_get';
      else intent = best.sort(function (a, b) { return b.n - a.n; })[0].it.id;
      if (intent === 'where_get' && !docs.length && best.length > 1) intent = best.filter(function (x) { return x.it.id !== 'where_get'; })[0].it.id;
    }
    var greet = GREET.some(function (g) { return hasWord(qn, qt, g); }) && kt.length <= 2;
    var thanks = THANKS.some(function (g) { return hasWord(qn, qt, g); }) && kt.length <= 3;
    var asksSchemes = /\b(scheme|schemes|yojana|programme|program)\b|திட்ட/.test(qn);
    return { asksSchemes: asksSchemes, raw: q, normalised: qn, tokens: qt, keywords: kt, concepts: concepts, schemes: schemesFound, docs: docs, intent: intent, greet: greet, thanks: thanks };
  }

  /* ---------- 8: knowledge base + scoring (FAQ retrieval) ---------- */
  var KB = null, IDF = null;
  function buildKB() {
    var chunks = [];
    S().faqs().forEach(function (f) {
      chunks.push({ kind: 'faq', faq: f, qTokens: keyTokens(f.q_en + ' ' + (f.q_ta || '')), tokens: keyTokens(f.q_en + ' ' + f.a_en + ' ' + (f.q_ta || '') + ' ' + (f.a_ta || '')) });
    });
    var df = {};
    chunks.forEach(function (c) { var seen = {}; c.tokens.forEach(function (t) { if (!seen[t]) { seen[t] = 1; df[t] = (df[t] || 0) + 1; } }); });
    IDF = {}; Object.keys(df).forEach(function (t) { IDF[t] = Math.log(1 + chunks.length / df[t]); });
    KB = chunks;
  }
  function tokMatch(a, b) { if (a === b) return true; if (isTamil(a) && isTamil(b)) { var n = Math.min(5, a.length, b.length); return n >= 3 && a.slice(0, n) === b.slice(0, n); } return false; }
  function rankFaqs(a) {
    if (!KB) buildKB();
    var conceptWords = [];
    a.concepts.forEach(function (c) { conceptWords = conceptWords.concat(CONCEPTS[c].map(stem)); });
    return KB.map(function (c) {
      var score = 0, hit = [];
      a.keywords.forEach(function (k) {
        var inQ = c.qTokens.some(function (t) { return tokMatch(k, t); }), inA = inQ || c.tokens.some(function (t) { return tokMatch(k, t); });
        if (inA) { var w = IDF[k] || 1; score += inQ ? w * 1.6 : w; hit.push(k); }
      });
      a.concepts.forEach(function (cn) { if (CONCEPTS[cn].some(function (w) { return c.tokens.indexOf(stem(w)) > -1; })) score += 0.6; });
      return { chunk: c, score: Math.round(score * 100) / 100, hit: hit };
    }).filter(function (x) { return x.score > 0; }).sort(function (x, y) { return y.score - x.score; });
  }

  /* ---------- 9: answer builders ---------- */
  function sName(s) { return isTa() && s.name_ta ? s.name_ta : s.name_en; }
  function dName(d) { return isTa() && d.name_ta ? d.name_ta : d.name_en; }
  function base() { return (CC.ui && CC.ui.base) || ''; }
  function schemeHref(s, tab) { return base() + 'scheme.html?slug=' + s.slug + (tab ? '#' + tab : ''); }
  function ext(url, label) { return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label || url.replace(/^https?:\/\//, '')) + ' <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a>' : ''; }
  function list(items) { return '<ul class="bot-list">' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>'; }
  function enOnlyNote() { return isTa() ? '<div class="bot-note">(இந்தப் பகுதி தற்போது ஆங்கிலத்தில் மட்டும் உள்ளது)</div>' : ''; }

  function docAnswer(d, s) {
    var where = isTa() && d.where_ta ? d.where_ta : d.where_en;
    var html = '<p><strong>' + esc(dName(d)) + '</strong></p><p>' + esc(where) + '</p>';
    if (s) {
      var link = s.documents.find(function (x) { return x.id === d.id; });
      html += link ? '<p class="small">' + esc(T('bot.docFor', 'For this scheme it is')) + ' <strong>' + (link.mandatory ? esc(T('bot.mandatory', 'required')) : esc(T('bot.optional', 'optional'))) + '</strong>.</p>'
        : '<p class="small">' + esc(T('bot.docNotListed', 'This document is not on this scheme’s checklist.')) + '</p>';
    }
    var src = [{ label: T('bot.src.docguide', 'Document guide') + ' › ' + dName(d), href: base() + 'help.html#doc-' + d.id }];
    if (d.link) src.push({ label: (isTa() ? 'பெறும் இடம்: ' : 'Where to get it: ') + d.link_label, href: d.link, external: true });
    if (s) src.unshift({ label: sName(s) + ' › ' + T('tab.documents', 'Documents'), href: schemeHref(s, 'documents') });
    return { html: html, sources: src, section: 'where_get' };
  }

  function schemeAnswer(s, intent, a) {
    var inactive = !s.is_active ? '<div class="bot-warn"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i> ' + esc(T('bot.inactive', 'This scheme is no longer active on CivicConnect.')) + '</div>' : '';
    var html = '', tab = 'overview', sectionLabel = T('tab.overview', 'Overview & benefits');
    intent = intent || 'overview';
    if (intent === 'where_get' && a.docs.length) return docAnswer(S().doc(a.docs[0]), s);
    if (intent === 'where_get') intent = 'documents';
    if (intent === 'documents') {
      tab = 'documents'; sectionLabel = T('tab.documents', 'Documents');
      html = '<p>' + esc(T('bot.docsIntro', 'Documents listed for')) + ' <strong>' + esc(sName(s)) + '</strong>:</p>' +
        list(s.documents.map(function (x) { var d = S().doc(x.id); return '<strong>' + esc(dName(d)) + '</strong>' + (x.mandatory ? '' : ' <span class="text-muted">(' + esc(T('bot.optional', 'optional')) + ')</span>') +
          '<div class="small text-muted">' + esc(isTa() && d.where_ta ? d.where_ta : d.where_en) + '</div>'; }));
      html += '<p class="small">' + esc(T('bot.docsTip', 'Tick them off in the checklist on the scheme page. No uploads are needed.')) + '</p>';
    } else if (intent === 'eligibility') {
      tab = 'criteria'; sectionLabel = T('tab.criteria', 'Basic criteria');
      var who = esc(s.who_en);
      html = '<p><strong>' + esc(T('bot.whoFor', 'Who it is for')) + ':</strong> ' + who + '</p>' +
        list(s.criteria.map(function (c, i) { var or = i > 0 && c.group !== s.criteria[i - 1].group ? '<em>' + esc(T('bot.or', 'or')) + '</em> ' : ''; return or + esc(isTa() && c.label_ta ? c.label_ta : c.label_en); })) +
        (s.state ? '<p class="small">' + esc(T('bot.stateOnly', 'State scheme for residents of')) + ' ' + esc(s.state) + '.</p>' : '') +
        '<p class="small">' + esc(S().currentUser() ? T('bot.checkTab', 'Open the Basic criteria tab to see how your profile compares. This is guidance, not an official eligibility decision.') : T('bot.checkProfile', 'Log in and complete your profile to see how your details compare. This is guidance, not an official eligibility decision.')) + '</p>' + (isTa() ? enOnlyNote() : '');
    } else if (intent === 'benefits') {
      sectionLabel = T('tab.overview', 'Overview & benefits');
      html = '<p><strong>' + esc(T('bot.benefitsOf', 'Benefits of')) + ' ' + esc(sName(s)) + ':</strong></p>' + list(s.benefits_en.map(esc)) + enOnlyNote();
    } else if (intent === 'apply') {
      tab = 'source'; sectionLabel = T('tab.source', 'Source');
      html = '<p>' + esc(T('bot.applyIntro', 'CivicConnect does not accept applications. You apply on the official portal:')) + '</p><p>' + ext(s.official_url, T('bot.officialPortal', 'Official portal')) + '</p>' +
        list([esc(T('bot.apply1', 'Check the basic criteria on the scheme page.')), esc(T('bot.apply2', 'Keep the documents on the checklist ready.')), esc(T('bot.apply3', 'Apply on the official portal or at the office it names.'))]);
    } else if (intent === 'source') {
      tab = 'source'; sectionLabel = T('tab.source', 'Source');
      html = '<p><strong>' + esc(T('bot.source', 'Source')) + ':</strong> ' + esc(s.source_name) + '</p><p>' + ext(s.source_url) + '</p><p><strong>' + esc(T('bot.lastVerified', 'Last verified')) + ':</strong> ' + esc(CC.ui ? CC.ui.date(s.last_verified_on) : s.last_verified_on) + '</p>' +
        (s.is_verified ? '' : '<p class="small">' + esc(T('demo.ribbon', 'Demo data – not yet verified')) + '</p>');
    } else {
      html = '<p><strong>' + esc(sName(s)) + '</strong></p><p>' + esc(isTa() && s.short_ta ? s.short_ta : s.short_en) + '</p><p class="small"><strong>' + esc(T('bot.whoFor', 'Who it is for')) + ':</strong> ' + esc(s.who_en) + '</p>' + enOnlyNote();
    }
    var src = [{ label: T('bot.src.scheme', 'Scheme page') + ' › ' + sName(s) + ' › ' + sectionLabel, href: schemeHref(s, tab) },
      { label: T('bot.src.official', 'Official source') + ': ' + s.source_name, href: s.source_url, external: true }];
    return { html: inactive + html, sources: src, section: intent };
  }

  function faqAnswer(f) {
    var q = isTa() && f.q_ta ? f.q_ta : f.q_en, ans = isTa() && f.a_ta ? f.a_ta : f.a_en;
    return { html: '<p class="bot-q">' + esc(q) + '</p><p>' + esc(ans) + '</p>',
      sources: [{ label: T('bot.src.faq', 'Help & FAQs') + ' › ' + T('topic.' + f.topic, f.topic) + ' › ' + q, href: base() + 'help.html#faq-' + f.id }] };
  }

  function topicAnswer(slug) {
    var c = S().category(slug); if (!c) return null;
    var items = S().schemes({ category: slug });
    if (!items.length) return null;
    return { html: '<p>' + esc(T('bot.topicIntro', 'Schemes on CivicConnect for')) + ' <strong>' + esc(isTa() ? c.name_ta : c.name_en) + '</strong>:</p>' +
        list(items.map(function (s) { return '<a href="' + schemeHref(s) + '">' + esc(sName(s)) + '</a><div class="small text-muted">' + esc(isTa() && s.short_ta ? s.short_ta : s.short_en) + '</div>'; })) +
        '<p class="small">' + esc(T('bot.topicTip', 'Ask me about any of these, e.g. “documents for ' + sName(items[0]) + '”.')) + '</p>',
      sources: [{ label: T('nav.categories', 'Categories') + ' › ' + (isTa() ? c.name_ta : c.name_en), href: base() + 'schemes.html?category=' + slug }] };
  }

  function fallback(a, scope, schemeId) {
    S().logQuery(a.raw, scope === 'scheme' ? 'CHATBOT_SCHEME' : 'CHATBOT_GENERAL', schemeId);
    return { html: '<p>' + esc(T('bot.noAnswer', 'I couldn’t find this in CivicConnect’s documents, so I won’t guess.')) + '</p>' +
        list([esc(T('bot.try1', 'Try other words, e.g. a scheme name or a document name.')), '<a href="' + base() + 'help.html">' + esc(T('bot.try2', 'Browse Help & FAQs')) + '</a>', '<a href="' + base() + 'schemes.html">' + esc(T('bot.try3', 'Browse all 15 schemes')) + '</a>']) +
        '<p class="small text-muted"><i class="bi bi-journal-plus" aria-hidden="true"></i> ' + esc(T('bot.logged', 'Your question has been recorded so our team can review it.')) + '</p>',
      sources: [], logged: true };
  }

  /* words in the question that appear nowhere in this scheme's page, the document guide, intents or synonyms */
  function unknownWords(a, s) {
    var known = keyTokens([s.name_en, s.name_ta, (s.aliases || []).join(' '), s.short_en, s.short_ta, s.who_en, s.benefits_en.join(' '), s.source_name,
      s.criteria.map(function (c) { return c.label_en + ' ' + (c.label_ta || ''); }).join(' '),
      S().db().documents.map(function (d) { return d.name_en + ' ' + d.name_ta; }).join(' ')].join(' '));
    INTENTS.forEach(function (it) { known = known.concat(it.words.map(stem)); });
    Object.keys(CONCEPTS).forEach(function (k) { known = known.concat(CONCEPTS[k].map(stem)); });
    known = known.concat(['scheme', 'yojana', 'திட்ட', 'pm', 'get', 'need', 'apply', 'doc']);
    return a.keywords.filter(function (k) {
      if (k.length < 3) return false;
      return !known.some(function (w) { return w === k || (isTamil(k) && isTamil(w) && (k.indexOf(w) === 0 || w.indexOf(k) === 0 || tokMatch(k, w))); });
    });
  }

  /* ---------- main entry ---------- */
  function answer(q, ctx) {
    ctx = ctx || {}; var scope = ctx.scope || 'general', s0 = ctx.scheme || null;
    var a = analyse(q, ctx), r, conf = 'high';
    if (!a.keywords.length && a.greet) r = { html: '<p>' + esc(scope === 'scheme' ? T('bot.helloScheme', 'Vanakkam! Ask me anything about this scheme — who can apply, documents, benefits or how to apply.') : T('bot.hello', 'Vanakkam! Ask me about any of our 15 schemes, the documents you need, or how CivicConnect works.')) + '</p>', sources: [] };
    else if (a.thanks) r = { html: '<p>' + esc(T('bot.welcome', 'You’re welcome! Anything else?')) + '</p>', sources: [] };
    else if (a.greet && !a.intent && !a.schemes.length && !a.docs.length && !a.concepts.length) r = { html: '<p>' + esc(T('bot.hello', 'Vanakkam! Ask me about any of our 15 schemes, the documents you need, or how CivicConnect works.')) + '</p>', sources: [] };
    if (!r && scope === 'scheme' && !a.docs.length && unknownWords(a, s0).length) r = null, a.unknown = unknownWords(a, s0);
    if (!r && scope === 'scheme' && a.unknown) { /* topic not covered by this scheme's documents → honest fallback */ }
    else if (!r && scope === 'scheme') {
      var other = a.schemes.filter(function (x) { return x !== s0; });
      if (other.length && a.schemes.indexOf(s0) < 0) {
        r = { html: '<p>' + esc(T('bot.otherScheme', 'That sounds like a different scheme. Here is a short summary — open its page for full details.')) + '</p>' + schemeAnswer(other[0], a.intent, a).html,
          sources: schemeAnswer(other[0], a.intent, a).sources };
      } else if (a.docs.length && (a.intent === 'where_get' || !a.intent || a.intent === 'documents')) r = docAnswer(S().doc(a.docs[0]), s0);
      else if (a.intent && a.intent !== 'overview') r = schemeAnswer(s0, a.intent, a);
      else {
        var fr = rankFaqs(a);
        if (fr.length && fr[0].score >= 3) { r = faqAnswer(fr[0].chunk.faq); conf = 'faq'; }
        else if (a.intent === 'overview' || a.keywords.length <= 2) r = schemeAnswer(s0, 'overview', a);
      }
    }
    if (!r && scope === 'general') {
      var s = a.schemes[0];
      if (a.docs.length && (a.intent === 'where_get' || (!s && (a.intent === 'documents' || !a.intent)))) r = docAnswer(S().doc(a.docs[0]), s);
      else if (s) r = schemeAnswer(s, a.intent, a);
      else {
        var ranked = rankFaqs(a);
        var cat = a.concepts.map(function (c) { return CONCEPT_CATEGORY[c]; }).filter(Boolean)[0];
        var top = ranked.length ? ranked[0].score : 0;
        if (cat && (a.asksSchemes || top < 4.5) && (!a.intent || a.intent === 'overview' || a.intent === 'eligibility' || a.intent === 'benefits')) r = topicAnswer(cat);
        else if (top >= 3.2) { r = faqAnswer(ranked[0].chunk.faq); conf = 'faq'; }
        else if (cat) r = topicAnswer(cat);
        else if (ranked.length && ranked[0].score >= 2) { r = faqAnswer(ranked[0].chunk.faq); conf = 'medium'; }
        else {
          var hits = S().schemes({ keyword: a.keywords.join(' '), noLog: true });
          if (hits.length && hits.length < 15) r = { html: '<p>' + esc(T('bot.related', 'These schemes mention what you asked about:')) + '</p>' + list(hits.slice(0, 4).map(function (x) { return '<a href="' + schemeHref(x) + '">' + esc(sName(x)) + '</a>'; })),
            sources: [{ label: T('nav.discover', 'Discover') + ' › “' + a.keywords.join(' ') + '”', href: base() + 'schemes.html?q=' + encodeURIComponent(a.keywords.join(' ')) }] };
        }
      }
    }
    if (!r) r = fallback(a, scope, s0 && s0.id);
    r.analysis = a; r.confidence = conf;
    return r;
  }

  /* ---------- debug view for the admin test console ---------- */
  function debug(q, ctx) {
    var a = analyse(q, ctx || {});
    return { analysis: a, faqRanking: rankFaqs(a).slice(0, 5).map(function (x) { return { id: x.chunk.faq.id, question: x.chunk.faq.q_en, score: x.score, matched: x.hit }; }),
      reply: answer(q, Object.assign({ scope: 'general' }, ctx || {}, { dryRun: true })) };
  }

  /* ---------- UI: render a chat panel into any element ---------- */
  function intentLabel(id) { var it = INTENTS.find(function (x) { return x.id === id; }); return it ? it.label[isTa() ? 1 : 0] : ''; }

  function mount(el, opts) {
    opts = opts || {}; var scope = opts.scope || 'general', scheme = opts.scheme || null;
    var sugg = scope === 'scheme' ? [T('bot.sq1', 'Who can apply?'), T('bot.sq2', 'What documents are needed?'), T('bot.sq3', 'What are the benefits?'), T('bot.sq4', 'How do I apply?')]
      .concat(scheme && scheme.documents[0] ? [(isTa() ? '' : 'Where do I get the ') + dName(S().doc(scheme.documents[0].id)) + (isTa() ? ' எங்கே பெறுவது?' : '?')] : [])
      : [T('bot.gq1', 'Documents for PM-KISAN'), T('bot.gq2', 'Where can I get an income certificate?'), T('bot.gq3', 'Schemes for farmers'), T('bot.gq4', 'What does Partial match mean?'), T('bot.gq5', 'Free bus travel for women')];
    el.innerHTML =
      '<div class="bot" data-scope="' + scope + '">' +
        '<div class="bot-log" role="log" aria-live="polite" aria-label="' + esc(T('bot.logLabel', 'Conversation')) + '"></div>' +
        '<div class="bot-suggest" aria-label="' + esc(T('bot.suggestions', 'Suggested questions')) + '">' + sugg.map(function (q) { return '<button type="button" class="chip">' + esc(q) + '</button>'; }).join('') + '</div>' +
        '<form class="bot-form" autocomplete="off"><label class="visually-hidden" for="bot-in-' + scope + '">' + esc(T('bot.inputLabel', 'Type your question')) + '</label>' +
          '<input id="bot-in-' + scope + '" class="form-control" maxlength="255" placeholder="' + esc(scope === 'scheme' ? T('bot.phScheme', 'Ask about this scheme…') : T('bot.ph', 'Ask a question in English or தமிழ்…')) + '">' +
          '<button class="btn btn-primary" type="submit" aria-label="' + esc(T('bot.send', 'Send')) + '"><i class="bi bi-send" aria-hidden="true"></i></button></form>' +
        '<p class="bot-disclaimer">' + esc(T('bot.disclaimer', 'Answers come only from CivicConnect’s FAQs, scheme pages and document guide. Guidance only — not an official decision.')) + '</p>' +
      '</div>';
    var log = el.querySelector('.bot-log'), form = el.querySelector('form'), input = form.querySelector('input');

    function add(who, html) {
      var d = document.createElement('div'); d.className = 'msg msg-' + who; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
    }
    function ask(q) {
      q = String(q || '').trim(); if (!q) return;
      add('user', esc(q)); input.value = '';
      var typing = add('bot', '<span class="typing" aria-label="' + esc(T('bot.typing', 'Searching documents')) + '"><span></span><span></span><span></span></span>');
      setTimeout(function () {
        var r = answer(q, { scope: scope, scheme: scheme });
        var a = r.analysis;
        var chips = a.keywords.concat(a.concepts.map(function (c) { return '#' + c; })).concat(a.schemes.map(function (s) { return '★ ' + (s.aliases[0] || s.slug); }))
          .concat(a.docs.map(function (d) { return '📄 ' + d.replace(/_/g, ' '); }));
        var meta = chips.length ? '<div class="bot-meta"><span class="bot-meta-label">' + esc(T('bot.keywords', 'Keywords found')) + ':</span> ' + chips.slice(0, 8).map(function (c) { return '<span class="kw">' + esc(c) + '</span>'; }).join('') +
          (a.intent ? ' <span class="bot-intent">· ' + esc(T('bot.intent', 'Intent')) + ': ' + esc(intentLabel(a.intent)) + '</span>' : '') + '</div>' : '';
        var src = r.sources && r.sources.length ? '<div class="bot-source"><div class="bot-source-title"><i class="bi bi-journal-check" aria-hidden="true"></i> ' + esc(T('bot.sourceTitle', 'Source — where this is documented')) + '</div>' +
          r.sources.map(function (s) { return '<a href="' + esc(s.href) + '"' + (s.external ? ' target="_blank" rel="noopener"' : '') + '>' + esc(s.label) + (s.external ? ' <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>' : '') + '</a>'; }).join('') + '</div>' : '';
        typing.innerHTML = r.html + meta + src;
        log.scrollTop = log.scrollHeight;
      }, 380);
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
    el.querySelectorAll('.bot-suggest .chip').forEach(function (b) { b.addEventListener('click', function () { ask(b.textContent); }); });
    add('bot', '<p>' + esc(scope === 'scheme' ? T('bot.helloScheme', 'Vanakkam! Ask me anything about this scheme — who can apply, documents, benefits or how to apply.') : T('bot.hello', 'Vanakkam! Ask me about any of our 15 schemes, the documents you need, or how CivicConnect works.')) + '</p>');
    return { ask: ask };
  }

  /* floating general assistant (every citizen page) */
  function floating() {
    if (document.getElementById('bot-fab')) return;
    var fab = document.createElement('button');
    fab.id = 'bot-fab'; fab.className = 'bot-fab'; fab.type = 'button';
    fab.setAttribute('aria-controls', 'bot-panel'); fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = '<i class="bi bi-chat-dots-fill" aria-hidden="true"></i><span>' + esc(T('bot.fab', 'Ask CivicConnect')) + '</span>';
    var panel = document.createElement('section');
    panel.id = 'bot-panel'; panel.className = 'bot-panel'; panel.hidden = true; panel.setAttribute('aria-label', T('bot.title', 'CivicConnect Assistant'));
    panel.innerHTML = '<header class="bot-head"><div class="bot-avatar" aria-hidden="true"><i class="bi bi-chat-square-text"></i></div><div><h2>' + esc(T('bot.title', 'CivicConnect Assistant')) + '</h2>' +
      '<p>' + esc(T('bot.sub', 'Answers from our FAQs & scheme documents')) + '</p></div><button type="button" class="btn-close btn-close-white ms-auto" aria-label="' + esc(T('common.close', 'Close')) + '"></button></header><div class="bot-body"></div>';
    document.body.appendChild(panel); document.body.appendChild(fab);
    var api = null;
    function open(q) {
      panel.hidden = false; fab.setAttribute('aria-expanded', 'true'); fab.classList.add('is-open');
      if (!api) api = mount(panel.querySelector('.bot-body'), { scope: 'general' });
      setTimeout(function () { panel.querySelector('input').focus(); }, 50);
      if (q) api.ask(q);
    }
    function close() { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); fab.classList.remove('is-open'); fab.focus(); }
    fab.addEventListener('click', function () { panel.hidden ? open() : close(); });
    panel.querySelector('.btn-close').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });
    CC.bot.open = open;
  }

  return { analyse: analyse, answer: answer, debug: debug, mount: mount, floating: floating, CONCEPTS: CONCEPTS, INTENTS: INTENTS, DOC_WORDS: DOC_WORDS, rebuild: function () { KB = null; } };
})();
