// api/patient-directory.js
// GET /api/patient-directory — every active patient with their
// recorded allergies (aggregated) and most recent visit date. Used
// by the nurse dashboard's "Patients & Allergies" quick lookup — a
// read-only reference view, not a patient management page.
//
// last_visit counts 'in-progress' and 'completed' appointments as a
// "visit" (the patient was actually seen), not just fully 'completed'
// ones — since the completed-status flow on the doctor side isn't
// wired up yet. Once that flow exists, this can be narrowed back to
// just 'completed' if you want last_visit to mean "fully finished".

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await pool.query(
      `SELECT
         p.patient_id, p.first_name, p.last_name,
         (SELECT string_agg(DISTINCT COALESCE(m.generic_name, pa.allergen_description), ', ')
          FROM patient_allergies pa
          LEFT JOIN medications m ON pa.allergen_medication_id = m.medication_id
          WHERE pa.patient_id = p.patient_id) AS allergies,
         (SELECT MAX(a.scheduled_at)
          FROM appointments a
          WHERE a.patient_id = p.patient_id
            AND a.status IN ('completed', 'in-progress')) AS last_visit
       FROM patients p
       WHERE p.is_active = TRUE
       ORDER BY p.first_name, p.last_name`
    );
    return res.status(200).json({ count: result.rows.length, patients: result.rows });
  } catch (err) {
    console.error('Fetch patient directory error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};