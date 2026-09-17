// api/create-referral.js
// POST /api/create-referral — a doctor refers a patient out (pharmacy,
// lab, or hospital/specialist). Both hospital_id AND appointment_id
// are required (NOT NULL) by the schema — a referral always traces
// back to a specific visit, not just a patient in the abstract.
//
// referringDoctorId is passed in from the form rather than read from
// a session, because doctor.html has no login/session system yet —
// there's nothing to identify "the current doctor" server-side. Once
// real doctor auth exists, this should come from the session instead.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    patientId,
    appointmentId,
    referringDoctorId,
    hospitalId,
    referralType,
    reasonForReferral,
    urgencyLevel,
    linkedServiceId,
  } = req.body;

  if (!patientId || !appointmentId || !referringDoctorId || !hospitalId || !referralType || !reasonForReferral) {
    return res.status(400).json({
      error: 'patientId, appointmentId, referringDoctorId, hospitalId, referralType, and reasonForReferral are required',
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO referrals (patient_id, appointment_id, referring_doctor_id, hospital_id, linked_service_id, referral_type, reason_for_referral, urgency_level, status, created_at, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW(), NOW())
       RETURNING referral_id`,
      [patientId, appointmentId, referringDoctorId, hospitalId, linkedServiceId || null, referralType, reasonForReferral, urgencyLevel || 'Routine']
    );
    return res.status(201).json({ message: 'Referral created', referralId: result.rows[0].referral_id });
  } catch (err) {
    console.error('Create referral error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};