// api/billing-admin.js
// GET /api/billing-admin — every invoice (all patients) with patient
// name, item description(s), and amount paid so far, plus every
// payment (all patients) with patient name and invoice reference.
// This is the billing specialist's working view — unlike
// api/billing.js, it is NOT scoped to a single patientId.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const invoicesResult = await pool.query(
      `SELECT
         i.invoice_id, i.patient_id, i.invoice_date, i.total_amount, i.payment_status,
         p.first_name, p.last_name,
         (SELECT string_agg(ii.description, ', ')
          FROM invoice_items ii
          WHERE ii.invoice_id = i.invoice_id) AS description,
         COALESCE((SELECT SUM(pay.amount_paid) FROM payments pay WHERE pay.invoice_id = i.invoice_id), 0) AS amount_paid
       FROM invoices i
       JOIN patients p ON i.patient_id = p.patient_id
       ORDER BY i.invoice_date DESC`
    );

    const paymentsResult = await pool.query(
      `SELECT
         pay.payment_id, pay.invoice_id, pay.amount_paid, pay.payment_method, pay.paid_at,
         p.first_name, p.last_name
       FROM payments pay
       JOIN invoices i ON pay.invoice_id = i.invoice_id
       JOIN patients p ON i.patient_id = p.patient_id
       ORDER BY pay.paid_at DESC`
    );

    return res.status(200).json({
      invoices: invoicesResult.rows,
      payments: paymentsResult.rows,
    });
  } catch (err) {
    console.error('Fetch billing admin error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};
