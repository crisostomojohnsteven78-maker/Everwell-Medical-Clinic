// api/patient-allergies.js
// GET  /api/patient-allergies?patientId=5 -> list one patient's allergies
// GET  /api/patient-allergies              -> list ALL allergies (for the
//      nurse dashboard's "allergy alert" checks across many patients)
// POST /api/patient-allergies              -> add a new allergy record

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { patientId } = req.query;
    try {
      let query = `
        SELECT a.allergy_id, a.patient_id, a.allergen_description, a.reaction_description,
               a.severity, a.recorded_at, m.generic_name AS allergen_medication_name
        FROM patient_allergies a
        LEFT JOIN medications m ON a.allergen_medication_id = m.medication_id
      `;
      const params = [];
      if (patientId) {
        params.push(patientId);
        query += ` WHERE a.patient_id = $${params.length}`;
      }
      query += ' ORDER BY a.recorded_at DESC';

      const result = await pool.query(query, params);
      return res.status(200).json({ count: result.rows.length, allergies: result.rows });
    } catch (err) {
      console.error('Fetch allergies error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  if (req.method === 'POST') {
    const { patientId, allergenDescription, reactionDescription, severity } = req.body;

    if (!patientId || !allergenDescription || !severity) {
      return res.status(400).json({ error: 'patientId, allergenDescription, and severity are required' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO patient_allergies (patient_id, allergen_description, reaction_description, severity)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [patientId, allergenDescription, reactionDescription || null, severity]
      );
      return res.status(201).json({ message: 'Allergy recorded', allergy: result.rows[0] });
    } catch (err) {
      console.error('Record allergy error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
