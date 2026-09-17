// api/update-referral-status.js
// POST /api/update-referral-status — marks a referral pending/completed.
// Kept separate from api/referrals.js on purpose (that file is
// intentionally GET-only/read-focused — see its header comment).

const pool = require('../lib/db');

const ALLOWED_STATUSES = ['pending', 'completed'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { referralId, status } = req.body;

  if (!referralId || !status) {
    return res.status(400).json({ error: 'referralId and status are required' });
  }
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `UPDATE referrals SET status = $1 WHERE referral_id = $2 RETURNING referral_id`,
      [status, referralId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Referral not found' });
    }
    return res.status(200).json({ message: 'Referral status updated' });
  } catch (err) {
    console.error('Update referral status error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};
