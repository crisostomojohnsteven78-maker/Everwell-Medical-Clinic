// api/lab-results.js
// GET /api/lab-results?patientId=5 — every lab or imaging service a
// patient has booked (via appointment_services), joined with the
// service name, category, visit date, and doctor. Includes the real
// result_summary/result_file_url/resulted_at when staff have entered
// them, and 'ordered' status when they haven't yet.
//
// Scoped to the "Basic Laboratory Tests" and "Imaging Diagnostics"
// categories specifically — this backs the dashboard's "Lab & LIS
// Diagnostics" card, not general services like consultations.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { patientId } = req.query;
  if (!patientId) {
    return res.status(400).json({ error: 'patientId is required' });
  }

  try {
    const result = await pool.query(
      `SELECT
         aps.appointment_service_id,
         aps.appointment_id,
         aps.status,
         aps.result_summary,
         aps.result_file_url,
         aps.resulted_at,
         s.service_name,
         sc.category_name,
         a.scheduled_at,
         u.full_name AS doctor_name
       FROM appointment_services aps
       JOIN services s ON aps.service_id = s.service_id
       JOIN service_categories sc ON s.category_id = sc.category_id
       JOIN appointments a ON aps.appointment_id = a.appointment_id
       JOIN users u ON a.doctor_id = u.user_id
       WHERE a.patient_id = $1
         AND sc.category_name IN ('Basic Laboratory Tests', 'Imaging Diagnostics')
       ORDER BY a.scheduled_at DESC`,
      [patientId]
    );
    return res.status(200).json({ count: result.rows.length, results: result.rows });
  } catch (err) {
    console.error('Fetch lab results error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};
