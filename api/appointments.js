// api/appointments.js
// GET /api/appointments — lists appointments, now including the
// linked service's name AND its sub-category (e.g. "Specialty
// Outpatient Consultations", "Imaging Diagnostics"), so pages like
// the nurse triage queue can filter to just the heavier/urgent
// service categories instead of every appointment.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { doctorId, patientId, status } = req.query;

  try {
    let query = `
      SELECT
        a.appointment_id,
        a.appointment_type,
        a.scheduled_at,
        a.checked_in_at,
        a.status,
        p.patient_id,
        p.first_name AS patient_first_name,
        p.last_name AS patient_last_name,
        u.user_id AS doctor_id,
        u.full_name AS doctor_name,
        svc.service_name,
        svc.sub_category_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN users u ON a.doctor_id = u.user_id
      LEFT JOIN LATERAL (
        SELECT s.service_name, sc.category_name AS sub_category_name
        FROM appointment_services aps
        JOIN services s ON aps.service_id = s.service_id
        JOIN service_categories sc ON s.category_id = sc.category_id
        WHERE aps.appointment_id = a.appointment_id
        LIMIT 1
      ) svc ON true
      WHERE 1=1
    `;

    const params = [];

    if (doctorId) {
      params.push(doctorId);
      query += ` AND a.doctor_id = $${params.length}`;
    }

    if (patientId) {
      params.push(patientId);
      query += ` AND a.patient_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    query += ' ORDER BY a.scheduled_at ASC';

    const result = await pool.query(query, params);

    return res.status(200).json({
      count: result.rows.length,
      appointments: result.rows,
    });
  } catch (err) {
    console.error('Fetch appointments error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};