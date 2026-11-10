const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { loadSchemes } = require('../schemeRepo');
const { getProfile } = require('./profiles');
const { recommend, completion } = require('../utils/match');
const { wrap } = require('../utils/errors');

// GET /api/recommendations — schemes whose basic criteria match (or partly match) the logged-in user's profile.
// status is MATCH ("Basic Criteria Match") or PARTIAL ("complete your profile"). Guidance only, never "eligible".
router.get('/', requireAuth, wrap(async (req, res) => {
  const profile = await getProfile(req.user.user_id);
  const results = recommend(await loadSchemes(), profile)
    .sort((a, b) => (a.result.status === b.result.status ? 0 : a.result.status === 'MATCH' ? -1 : 1));
  res.json({
    disclaimer: 'Based on basic criteria only. The government department makes the final decision.',
    completion: completion(profile),
    matches: results.filter((x) => x.result.status === 'MATCH'),
    partial: results.filter((x) => x.result.status === 'PARTIAL')
  });
}));
module.exports = router;
