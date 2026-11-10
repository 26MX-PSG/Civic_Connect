/* Rule-based scheme matching: server port of assets/js/match.js (DESIGN.md section 6).
 * Criteria in the same group must all pass (AND); a scheme matches if any group passes (OR).
 * A criterion whose profile field is empty is "unknown" -> PARTIAL. Never says "eligible". */
const FIELD = { AGE: 'dob', GENDER: 'gender', ANNUAL_FAMILY_INCOME: 'income', OCCUPATION: 'occupation',
  STUDENT_LEVEL: 'student_level', FARMER_LAND_STATUS: 'farmer_land_status', DISABILITY_TYPE: 'disability_type', DISTRICT: 'district' };

function age(dob) {
  if (!dob) return null;
  const b = new Date(dob), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

// profile value for a criterion; undefined = unknown, null = known but not applicable
function valueFor(type, p) {
  switch (type) {
    case 'AGE': return p.dob ? age(p.dob) : undefined;
    case 'ANNUAL_FAMILY_INCOME': return p.income !== undefined && p.income !== null && p.income !== '' ? Number(p.income) : undefined;
    case 'STUDENT_LEVEL':
      if (p.student_level) return p.student_level;
      return p.occupation ? null : undefined;
    case 'FARMER_LAND_STATUS':
      if (p.farmer_land_status) return p.farmer_land_status;
      return p.occupation ? null : undefined;
    case 'DISABILITY_TYPE':
      if (p.disability_type === 'NONE') return null;
      return p.disability_type ? p.disability_type : undefined;
    default: { const v = p[FIELD[type]]; return v ? v : undefined; }
  }
}

function test(c, p) {
  const v = valueFor(c.type, p);
  if (v === undefined) return 'unknown';
  if (c.op === 'IS_SET') return v ? 'pass' : 'fail';
  if (v === null) return 'fail';
  const val = c.value;
  switch (c.op) {
    case '=': return String(v) === val ? 'pass' : 'fail';
    case 'IN': return val.split(',').indexOf(String(v)) > -1 ? 'pass' : 'fail';
    case '<': return Number(v) < Number(val) ? 'pass' : 'fail';
    case '<=': return Number(v) <= Number(val) ? 'pass' : 'fail';
    case '>': return Number(v) > Number(val) ? 'pass' : 'fail';
    case '>=': return Number(v) >= Number(val) ? 'pass' : 'fail';
    case 'BETWEEN': { const r = val.split(','); return Number(v) >= Number(r[0]) && Number(v) <= Number(r[1]) ? 'pass' : 'fail'; }
    default: return 'unknown';
  }
}

function evaluate(s, p) {
  p = p || {};
  let stateRes = 'pass';
  if (s.level === 'STATE' && s.state) stateRes = p.state ? (p.state === s.state ? 'pass' : 'fail') : 'unknown';
  const groups = {};
  const per = s.criteria.map((c) => { const r = test(c, p); (groups[c.group] = groups[c.group] || []).push({ c, r }); return { c, r }; });
  const gRes = Object.keys(groups).map((g) => {
    const rs = groups[g].map((x) => x.r).concat([stateRes]);
    return { items: groups[g], res: rs.includes('fail') ? 'fail' : rs.includes('unknown') ? 'unknown' : 'pass' };
  });
  const status = gRes.some((g) => g.res === 'pass') ? 'MATCH' : gRes.some((g) => g.res === 'unknown') ? 'PARTIAL' : 'NONE';
  const reasons = [], missing = [];
  const relevant = status === 'MATCH' ? gRes.filter((g) => g.res === 'pass').slice(0, 1) : gRes.filter((g) => g.res === 'unknown');
  relevant.forEach((g) => g.items.forEach((x) => {
    if (x.r === 'pass') reasons.push(x.c);
    if (x.r === 'unknown' && !missing.includes(FIELD[x.c.type])) missing.push(FIELD[x.c.type]);
  }));
  if (stateRes === 'pass' && s.state) reasons.push({ label_en: 'Lives in ' + s.state, label_ta: s.state + ' வசிப்பவர்' });
  if (stateRes === 'unknown' && !missing.includes('state')) missing.push('state');
  return { status, perCriterion: per.map((x) => ({ criterion: x.c, result: x.r })), stateResult: stateRes, reasons, missing };
}

function recommend(schemes, p) {
  return schemes.map((s) => ({ scheme: s, result: evaluate(s, p) })).filter((x) => x.result.status !== 'NONE');
}

function completion(p) {
  if (!p) return 0;
  const f = ['dob', 'gender', 'income', 'occupation', 'state', 'district'];
  let done = f.filter((k) => p[k] !== null && p[k] !== undefined && p[k] !== '').length;
  let total = f.length + 1;
  if (p.disability_type !== undefined && p.disability_type !== null) done++;
  if (p.occupation === 'STUDENT') { total++; if (p.student_level) done++; }
  if (p.occupation === 'FARMER') { total++; if (p.farmer_land_status) done++; }
  return Math.round((done * 100) / total);
}

module.exports = { evaluate, recommend, completion, age, FIELD };
