// api/patient-medical-info.js
// GET  /api/patient-medical-info?patientId=5 — returns blood_type,
//      height_cm, weight_kg from patients, plus every row in
//      patient_allergies for that patient.
// POST /api/patient-medical-info — updates the same patients columns
//      and replaces the patient's allergy list wholesale with whatever
//      array is submitted (simplest way to support an add/remove list
//      in the UI without tracking individual allergy IDs client-side).

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { patientId } = req.query;
    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }
    try {
      const patientResult = await pool.query(
        `SELECT patient_id, blood_type, height_cm, weight_kg FROM patients WHERE patient_id = $1`,
        [patientId]
      );
      if (patientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      const allergiesResult = await pool.query(
        `SELECT allergy_id, allergen_medication_id, allergen_description, reaction_description, severity, recorded_at
         FROM patient_allergies WHERE patient_id = $1 ORDER BY recorded_at DESC`,
        [patientId]
      );
      return res.status(200).json({
        patient: patientResult.rows[0],
        allergies: allergiesResult.rows,
      });
    } catch (err) {
      console.error('Fetch medical info error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  if (req.method === 'POST') {
    const { patientId, bloodType, heightCm, weightKg, allergies } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE patients SET blood_type = $1, height_cm = $2, weight_kg = $3 WHERE patient_id = $4`,
        [bloodType || null, heightCm || null, weightKg || null, patientId]
      );

      // Full replace: clear the patient's current allergy list, then
      // insert whatever the submitted list has now. Simpler and safer
      // than trying to diff/patch individual rows from the client.
      await client.query('DELETE FROM patient_allergies WHERE patient_id = $1', [patientId]);

      if (Array.isArray(allergies)) {
        for (const a of allergies) {
          if (!a.allergenDescription) continue;
          await client.query(
            `INSERT INTO patient_allergies (patient_id, allergen_description, reaction_description, severity, recorded_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [patientId, a.allergenDescription, a.reactionDescription || null, a.severity || 'Mild']
          );
        }
      }

      await client.query('COMMIT');
      return res.status(200).json({ message: 'Medical info updated' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Update medical info error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
