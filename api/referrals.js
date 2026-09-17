// api/referrals.js
// GET /api/referrals — every referral, joined with the referring
// doctor, the assigned hospital, and the linked service.
// GET /api/referrals?patientId=5 — scoped to one patient (used by
// the patient-facing Referrals tab).
//
// patientId is optional, matching api/appointments.js's pattern —
// admin-side callers (like the Reports page's "Active Referrals"
// stat) need the unscoped, clinic-wide list; patient-facing pages
// pass patientId to scope it to just their own referrals.
//
// Read-only on purpose: hospital_id is a required (NOT NULL) column,
// meaning a referral always has its hospital assigned by staff at
// creation time — there's no patient-facing hospital selection step
// to build here.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { patientId } = req.query;

  try {
    let query = `
      SELECT
         r.referral_id, r.appointment_id, r.patient_id, r.referring_doctor_id, r.hospital_id, r.linked_service_id,
         r.referral_type, r.reason_for_referral, r.urgency_level, r.clinical_snapshot, r.status,
         r.document_url, r.created_at, r.sent_at,
         p.first_name AS patient_first_name, p.last_name AS patient_last_name,
         u.full_name AS referring_doctor_name,
         h.hospital_name, h.hospital_type, h.address AS hospital_address, h.contact_number AS hospital_contact,
         s.service_name AS linked_service_name
       FROM referrals r
       JOIN patients p ON r.patient_id = p.patient_id
       JOIN users u ON r.referring_doctor_id = u.user_id
       JOIN hospitals h ON r.hospital_id = h.hospital_id
       LEFT JOIN services s ON r.linked_service_id = s.service_id
       WHERE 1=1
    `;

    const params = [];
    if (patientId) {
      params.push(patientId);
      query += ` AND r.patient_id = $${params.length}`;
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);
    return res.status(200).json({ count: result.rows.length, referrals: result.rows });
  } catch (err) {
    console.error('Fetch referrals error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};