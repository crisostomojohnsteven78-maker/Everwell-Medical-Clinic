// api/medications.js
// GET /api/medications — lists every medication, used to populate
// medication pickers (e.g. adding a new inventory batch).

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await pool.query(
      `SELECT medication_id, generic_name, brand_name, drug_class, dosage_form, strength, is_controlled_substance, requires_prescription, unit_price
       FROM medications
       ORDER BY generic_name`
    );
    return res.status(200).json({ count: result.rows.length, medications: result.rows });
  } catch (err) {
    console.error('Fetch medications error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};
