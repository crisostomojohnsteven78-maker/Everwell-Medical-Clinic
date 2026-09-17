// api/medical-records.js
// GET  /api/medical-records                -> list all records
// GET  /api/medical-records?patientId=5    -> just one patient's records,
//      now also joined with that visit's real triage_vitals if recorded
// GET  /api/medical-records?doctorId=2     -> just one doctor's records
//      (used by the doctor dashboard's "view as" switcher)
// POST /api/medical-records                -> create a new SOAP note

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { patientId, doctorId } = req.query;
    try {
      let query = `
        SELECT mr.record_id, mr.appointment_id, mr.subjective, mr.objective,
               mr.assessment, mr.plan, mr.diagnosis_code, mr.diagnosis_description,
               mr.created_at, mr.updated_at,
               p.patient_id, p.first_name AS patient_first_name, p.last_name AS patient_last_name,
               u.full_name AS doctor_name,
               tv.blood_pressure, tv.pulse_rate_bpm, tv.temperature_celsius, tv.weight_kg
        FROM medical_records mr
        JOIN appointments a ON mr.appointment_id = a.appointment_id
        JOIN patients p ON a.patient_id = p.patient_id
        JOIN users u ON mr.doctor_id = u.user_id
        LEFT JOIN triage_vitals tv ON tv.appointment_id = a.appointment_id
        WHERE mr.is_active = TRUE
      `;
      const params = [];
      if (patientId) {
        params.push(patientId);
        query += ` AND p.patient_id = $${params.length}`;
      }
      if (doctorId) {
        params.push(doctorId);
        query += ` AND mr.doctor_id = $${params.length}`;
      }
      query += ' ORDER BY mr.created_at DESC';

      const result = await pool.query(query, params);
      return res.status(200).json({ count: result.rows.length, records: result.rows });
    } catch (err) {
      console.error('Fetch medical records error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  if (req.method === 'POST') {
    const { appointmentId, doctorId, subjective, objective, assessment, plan, diagnosisCode, diagnosisDescription } = req.body;

    if (!appointmentId || !doctorId) {
      return res.status(400).json({ error: 'appointmentId and doctorId are required' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO medical_records
           (appointment_id, doctor_id, subjective, objective, assessment, plan, diagnosis_code, diagnosis_description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [appointmentId, doctorId, subjective || null, objective || null, assessment || null, plan || null, diagnosisCode || null, diagnosisDescription || null]
      );
      return res.status(201).json({ message: 'Medical record created', record: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'This appointment already has a medical record' });
      }
      console.error('Create medical record error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};