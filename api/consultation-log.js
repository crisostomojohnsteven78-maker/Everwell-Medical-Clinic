// api/consultation-log.js
// GET  /api/consultation-log — list all logged consultations, most recent first.
// POST /api/consultation-log — log a new consultation (patient name, service, notes).
//
// PLACEHOLDER_PHARMACIST_ID: matches pharmacy-dispense.js and
// pharmacy-reject.js — no real staff login yet on this dashboard, so
// we record consultations under the placeholder "Everwell Pharmacy"
// account (user_id 15) until real staff auth is built for this page.

const pool = require('../lib/db');

const PLACEHOLDER_PHARMACIST_ID = 15; // Everwell Pharmacy (Pharmacist role)

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const result = await pool.query(
        `SELECT consultation_id, patient_name, service, notes, consultation_date
         FROM consultations
         ORDER BY consultation_date DESC`
      );
      return res.status(200).json({ count: result.rows.length, consultations: result.rows });
    } catch (err) {
      console.error('Fetch consultations error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  if (req.method === 'POST') {
    const { patient, service, notes } = req.body;

    if (!patient || !service) {
      return res.status(400).json({ error: 'Patient name and service are required' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO consultations (patient_name, service, notes, pharmacist_id, consultation_date)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING consultation_id`,
        [patient, service, notes || null, PLACEHOLDER_PHARMACIST_ID]
      );
      return res.status(201).json({ message: 'Consultation logged', consultationId: result.rows[0].consultation_id });
    } catch (err) {
      console.error('Log consultation error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
