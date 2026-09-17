// api/hospitals.js
// GET /api/hospitals — lists hospitals, defaults to only ones that
// currently accept referrals (?all=true to see every hospital).

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { all } = req.query;

  try {
    let query = `SELECT hospital_id, hospital_name, hospital_type, address, contact_number, accepts_referrals FROM hospitals`;
    if (!all) query += ` WHERE accepts_referrals = TRUE`;
    query += ` ORDER BY hospital_name`;

    const result = await pool.query(query);
    return res.status(200).json({ count: result.rows.length, hospitals: result.rows });
  } catch (err) {
    console.error('Fetch hospitals error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};
