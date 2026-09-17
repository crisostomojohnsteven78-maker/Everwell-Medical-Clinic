// api/record-vitals.js
// POST /api/record-vitals — a nurse records vital signs for a checked-in
// patient. Inserts a real triage_vitals row (this visit's snapshot),
// updates the patient's profile height/weight if given (patients.height_cm
// / weight_kg hold their latest known values), and advances the
// appointment from 'checked-in' to 'in-progress' — which is what makes
// the patient show up in the doctor's "My Patients" queue.
//
// PLACEHOLDER_NURSE_ID: no real nurse login yet, so vitals are recorded
// under the placeholder "Everwell Nursing" account (user_id 16), same
// pattern as the pharmacist/billing placeholders until real staff auth
// is built.

const pool = require('../lib/db');

const PLACEHOLDER_NURSE_ID = 16; // Everwell Nursing (Nurse role)

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    appointmentId,
    bloodPressure,
    pulseRateBpm,
    temperatureCelsius,
    respiratoryRate,
    weightKg,
    heightCm,
    chiefComplaint,
    urgencyLevel,
  } = req.body;

  if (!appointmentId) {
    return res.status(400).json({ error: 'appointmentId is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const apptResult = await client.query(
      `SELECT appointment_id, patient_id, status FROM appointments WHERE appointment_id = $1`,
      [appointmentId]
    );
    if (apptResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Appointment not found' });
    }
    const patientId = apptResult.rows[0].patient_id;

    await client.query(
      `INSERT INTO triage_vitals (appointment_id, recorded_by, blood_pressure, temperature_celsius, pulse_rate_bpm, respiratory_rate, weight_kg, chief_complaint, urgency_level, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        appointmentId,
        PLACEHOLDER_NURSE_ID,
        bloodPressure || null,
        temperatureCelsius || null,
        pulseRateBpm || null,
        respiratoryRate || null,
        weightKg || null,
        chiefComplaint || null,
        urgencyLevel || 'Routine',
      ]
    );

    if (weightKg || heightCm) {
      await client.query(
        `UPDATE patients SET
           weight_kg = COALESCE($1, weight_kg),
           height_cm = COALESCE($2, height_cm)
         WHERE patient_id = $3`,
        [weightKg || null, heightCm || null, patientId]
      );
    }

    await client.query(
      `UPDATE appointments SET status = 'in-progress' WHERE appointment_id = $1`,
      [appointmentId]
    );

    await client.query('COMMIT');
    return res.status(201).json({ message: 'Vitals recorded' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Record vitals error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  } finally {
    client.release();
  }
};
