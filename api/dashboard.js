// api/dashboard.js
// GET /api/dashboard — overview stats, a short triage preview, and
// recent activity for the nurse dashboard landing page. Reuses the
// same appointments lifecycle ('checked-in' -> 'in-progress' ->
// 'completed') and allergy-join pattern as triage-queue.js and
// patient-directory.js.
//
// seen_today counts 'in-progress' and 'completed' appointments (the
// patient was actually seen), matching the last_visit fix in
// patient-directory.js — the doctor-side 'completed' flow isn't
// wired up yet, so 'in-progress' is the best current signal.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const statsResult = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM appointments
           WHERE status = 'checked-in' AND scheduled_at::date = CURRENT_DATE) AS awaiting,
         (SELECT COUNT(*) FROM triage_vitals
           WHERE recorded_at::date = CURRENT_DATE) AS triaged_today,
         (SELECT COUNT(*) FROM appointments
           WHERE status IN ('completed', 'in-progress')
             AND scheduled_at::date = CURRENT_DATE) AS seen_today,
         (SELECT COUNT(DISTINCT a.patient_id) FROM appointments a
           WHERE a.status = 'checked-in' AND a.scheduled_at::date = CURRENT_DATE
             AND EXISTS (
               SELECT 1 FROM patient_allergies pa WHERE pa.patient_id = a.patient_id
             )
         ) AS allergy_alerts`
    );
    const s = statsResult.rows[0];

    const previewResult = await pool.query(
      `SELECT a.appointment_id, a.scheduled_at, p.first_name, p.last_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       WHERE a.status = 'checked-in' AND a.scheduled_at::date = CURRENT_DATE
       ORDER BY a.scheduled_at ASC
       LIMIT 5`
    );
    const triagePreview = previewResult.rows.map((r) => ({
      appointmentId: r.appointment_id,
      patient: `${r.first_name} ${r.last_name}`,
      scheduledAt: r.scheduled_at,
    }));

    const activityResult = await pool.query(
      `SELECT tv.recorded_at, p.first_name, p.last_name
       FROM triage_vitals tv
       JOIN appointments a ON tv.appointment_id = a.appointment_id
       JOIN patients p ON a.patient_id = p.patient_id
       ORDER BY tv.recorded_at DESC
       LIMIT 10`
    );
    const activity = activityResult.rows.map((r) => ({
      text: `Vitals recorded for ${r.first_name} ${r.last_name}`,
      time: r.recorded_at,
    }));

    return res.status(200).json({
      stats: {
        awaiting: Number(s.awaiting),
        triagedToday: Number(s.triaged_today),
        allergyAlerts: Number(s.allergy_alerts),
        seenToday: Number(s.seen_today),
      },
      allergyAlertsCount: Number(s.allergy_alerts),
      triagePreview,
      activity,
    });
  } catch (err) {
    console.error('Fetch dashboard error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};