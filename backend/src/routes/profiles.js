const router = require('express').Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { wrap, bad } = require('../utils/errors');
const v = require('../utils/validate');
const C = require('../constants');
const { completion } = require('../utils/match');

const EMPTY = { dob: null, gender: null, income: null, occupation: null, state: null, district: null, student_level: null, farmer_land_status: null, disability_type: null };
const FIELDS = Object.keys(EMPTY);

async function getProfile(uid) {
  const [rows] = await pool.query('SELECT ' + FIELDS.join(',') + ' FROM profiles WHERE user_id=?', [uid]);
  return rows[0] || { ...EMPTY };
}

// GET /api/profiles/me
router.get('/me', requireAuth, wrap(async (req, res) => {
  const p = await getProfile(req.user.user_id);
  res.json({ profile: p, completion: completion(p) });
}));

// PUT /api/profiles/me — replaces the whole profile (send every field you want to keep)
router.put('/me', requireAuth, wrap(async (req, res) => {
  const b = req.body;
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw bad('Send the profile as a JSON object');
  const p = {
    dob: v.date(b.dob, 'dob'),
    gender: v.oneOf(b.gender, C.gender, 'gender'),
    income: v.int(b.income, 'income', { min: 0, max: 100000000 }),
    occupation: v.oneOf(b.occupation, C.occupation, 'occupation'),
    state: v.oneOf(b.state, C.states, 'state'),
    district: v.str(b.district, 'district', { max: 80, required: false }),
    student_level: v.oneOf(b.student_level, C.student_level, 'student_level'),
    farmer_land_status: v.oneOf(b.farmer_land_status, C.farmer_land_status, 'farmer_land_status'),
    disability_type: v.oneOf(b.disability_type, C.disability_type, 'disability_type')
  };
  // keep follow-up answers consistent with occupation
  if (p.occupation !== 'STUDENT') p.student_level = null;
  if (p.occupation !== 'FARMER') p.farmer_land_status = null;
  await pool.query(`INSERT INTO profiles (user_id,${FIELDS.join(',')}) VALUES (?,${FIELDS.map(() => '?').join(',')})
    ON DUPLICATE KEY UPDATE ${FIELDS.map((f) => f + '=VALUES(' + f + ')').join(',')}`, [req.user.user_id, ...FIELDS.map((f) => p[f])]);
  res.json({ profile: p, completion: completion(p) });
}));

module.exports = router;
module.exports.getProfile = getProfile;
