/* CivicConnect — rule-based scheme matching (Team 2 doc, section 6).
 * Criteria in the same criteria_group must all pass (AND).
 * A scheme matches if any one group passes (OR).
 * A criterion whose profile field is empty is "unknown" → Partial match.
 * Results are labelled "Basic Criteria Match" — never "Eligible".
 */
window.CC = window.CC || {};

CC.match = (function () {
  var FIELD = { AGE: 'dob', GENDER: 'gender', ANNUAL_FAMILY_INCOME: 'income', OCCUPATION: 'occupation',
    STUDENT_LEVEL: 'student_level', FARMER_LAND_STATUS: 'farmer_land_status', DISABILITY_TYPE: 'disability_type', DISTRICT: 'district' };

  function age(dob) {
    if (!dob) return null;
    var b = new Date(dob), n = new Date();
    var a = n.getFullYear() - b.getFullYear();
    if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
    return a;
  }

  /* returns the profile value for a criterion, or undefined when unknown */
  function valueFor(type, p) {
    switch (type) {
      case 'AGE': return p.dob ? age(p.dob) : undefined;
      case 'ANNUAL_FAMILY_INCOME': return (p.income || p.income === 0) && p.income !== '' ? Number(p.income) : undefined;
      case 'STUDENT_LEVEL':
        if (p.student_level) return p.student_level;
        return p.occupation ? null : undefined;            // occupation known but no level → not a student
      case 'FARMER_LAND_STATUS':
        if (p.farmer_land_status) return p.farmer_land_status;
        return p.occupation ? null : undefined;
      case 'DISABILITY_TYPE':
        if (p.disability_type === 'NONE') return null;      // user said "no disability"
        return p.disability_type ? p.disability_type : undefined;
      default:
        var v = p[FIELD[type]]; return v ? v : undefined;
    }
  }

  function test(c, p) {
    var v = valueFor(c.type, p);
    if (v === undefined) return 'unknown';
    if (c.op === 'IS_SET') return v ? 'pass' : 'fail';
    if (v === null) return 'fail';
    var val = c.value;
    switch (c.op) {
      case '=': return String(v) === val ? 'pass' : 'fail';
      case 'IN': return val.split(',').indexOf(String(v)) > -1 ? 'pass' : 'fail';
      case '<': return Number(v) < Number(val) ? 'pass' : 'fail';
      case '<=': return Number(v) <= Number(val) ? 'pass' : 'fail';
      case '>': return Number(v) > Number(val) ? 'pass' : 'fail';
      case '>=': return Number(v) >= Number(val) ? 'pass' : 'fail';
      case 'BETWEEN': var r = val.split(','); return Number(v) >= Number(r[0]) && Number(v) <= Number(r[1]) ? 'pass' : 'fail';
    }
    return 'unknown';
  }

  function evaluate(s, p) {
    p = p || {};
    var stateRes = 'pass';
    if (s.level === 'STATE' && s.state) stateRes = p.state ? (p.state === s.state ? 'pass' : 'fail') : 'unknown';
    var groups = {};
    var per = s.criteria.map(function (c) { var r = test(c, p); (groups[c.group] = groups[c.group] || []).push({ c: c, r: r }); return { c: c, r: r }; });
    var gRes = Object.keys(groups).map(function (g) {
      var rs = groups[g].map(function (x) { return x.r; }).concat([stateRes]);
      return { items: groups[g], res: rs.indexOf('fail') > -1 ? 'fail' : rs.indexOf('unknown') > -1 ? 'unknown' : 'pass' };
    });
    var status = gRes.some(function (g) { return g.res === 'pass'; }) ? 'MATCH' : gRes.some(function (g) { return g.res === 'unknown'; }) ? 'PARTIAL' : 'NONE';
    var reasons = [], missing = [];
    var relevant = status === 'MATCH' ? gRes.filter(function (g) { return g.res === 'pass'; }).slice(0, 1) : gRes.filter(function (g) { return g.res === 'unknown'; });
    relevant.forEach(function (g) {
      g.items.forEach(function (x) {
        if (x.r === 'pass') reasons.push(x.c); if (x.r === 'unknown' && missing.indexOf(FIELD[x.c.type]) < 0) missing.push(FIELD[x.c.type]);
      });
    });
    if (stateRes === 'pass' && s.state) reasons.push({ label_en: 'Lives in ' + s.state, label_ta: s.state + ' வசிப்பவர்' });
    if (stateRes === 'unknown' && missing.indexOf('state') < 0) missing.push('state');
    return { status: status, perCriterion: per, stateResult: stateRes, reasons: reasons, missing: missing };
  }

  function recommend(p) {
    return CC.store.schemes().map(function (s) { return { scheme: s, result: evaluate(s, p) }; })
      .filter(function (x) { return x.result.status !== 'NONE'; });
  }

  function completion(p) {
    if (!p) return 0;
    var f = ['dob', 'gender', 'income', 'occupation', 'state', 'district'];
    var done = f.filter(function (k) { return p[k]; }).length;
    var total = f.length + 1; if (p.disability_type !== undefined && p.disability_type !== null) done++;
    if (p.occupation === 'STUDENT') { total++; if (p.student_level) done++; }
    if (p.occupation === 'FARMER') { total++; if (p.farmer_land_status) done++; }
    return Math.round(done * 100 / total);
  }

  return { evaluate: evaluate, recommend: recommend, completion: completion, age: age, FIELD: FIELD };
})();
