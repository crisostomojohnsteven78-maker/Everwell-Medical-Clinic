// api/doctors.js
// GET /api/doctors — lists active doctors, now including their real
// specialization (from staff_profiles), so the booking page can show
// different doctors per service instead of the same list everywhere.
// Optional ?specialization=Cardiology filters to just that specialty.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { specialization } = req.query;

  try {
    let query = `
      SELECT u.user_id, u.full_name, sp.specialization
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN staff_profiles sp ON sp.user_id = u.user_id
      WHERE r.role_name = 'Doctor' AND u.status = 'active'
    `;
    const params = [];
    if (specialization) {
      params.push(specialization);
      query += ` AND sp.specialization = $${params.length}`;
    }
    query += ' ORDER BY u.full_name';

    const result = await pool.query(query, params);
    return res.status(200).json({ count: result.rows.length, doctors: result.rows });
  } catch (err) {
    console.error('Fetch doctors error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};
