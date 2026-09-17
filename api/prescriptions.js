// api/prescriptions.js
// GET /api/prescriptions?patientId=5 — lists a patient's prescriptions,
// each joined with its prescribed medication items (drug name, dosage,
// frequency, dispensing status) so the dashboard can show real details
// instead of just a count.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { patientId, doctorId, validationStatus } = req.query;

  try {
    let query = `
      SELECT
        pr.prescription_id,
        pr.record_id,
        pr.patient_id,
        pr.doctor_id,
        pr.prescribed_at,
        pr.validation_status,
        pr.validated_by,
        pr.validated_at,
        u.full_name AS doctor_name,
        a.appointment_id,
        a.scheduled_at AS visit_date,
        (SELECT s.service_name
         FROM appointment_services aps
         JOIN services s ON aps.service_id = s.service_id
         WHERE aps.appointment_id = a.appointment_id
         LIMIT 1) AS service_name,
        pi.prescription_item_id,
        pi.dosage,
        pi.frequency,
        pi.duration_days,
        pi.quantity_prescribed,
        pi.instructions,
        pi.dispensing_status,
        m.medication_id,
        m.generic_name,
        m.brand_name,
        m.dosage_form,
        m.strength
      FROM prescriptions pr
      JOIN users u ON pr.doctor_id = u.user_id
      LEFT JOIN medical_records mr ON pr.record_id = mr.record_id
      LEFT JOIN appointments a ON mr.appointment_id = a.appointment_id
      LEFT JOIN prescription_items pi ON pi.prescription_id = pr.prescription_id
      LEFT JOIN medications m ON pi.medication_id = m.medication_id
      WHERE 1=1
    `;

    const params = [];

    if (patientId) {
      params.push(patientId);
      query += ` AND pr.patient_id = $${params.length}`;
    }

    if (doctorId) {
      params.push(doctorId);
      query += ` AND pr.doctor_id = $${params.length}`;
    }

    if (validationStatus) {
      params.push(validationStatus);
      query += ` AND pr.validation_status = $${params.length}`;
    }

    query += ' ORDER BY pr.prescribed_at DESC';

    const result = await pool.query(query, params);

    return res.status(200).json({
      count: result.rows.length,
      prescriptions: result.rows,
    });
  } catch (err) {
    console.error('Fetch prescriptions error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};