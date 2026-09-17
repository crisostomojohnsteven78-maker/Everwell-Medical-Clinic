// api/billing.js
// GET /api/billing?patientId=5 — every invoice for a patient (with
// its item description(s) and amount paid so far), plus their full
// payment history. There's no insurance-tracking column anywhere in
// this schema, so billing stats are built only from what's real:
// outstanding balance, total paid, and the most recent payment.

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
    const invoicesResult = await pool.query(
      `SELECT
         i.invoice_id, i.invoice_date, i.total_amount, i.payment_status,
         (SELECT string_agg(ii.description, ', ')
          FROM invoice_items ii
          WHERE ii.invoice_id = i.invoice_id) AS description,
         COALESCE((SELECT SUM(p.amount_paid) FROM payments p WHERE p.invoice_id = i.invoice_id), 0) AS amount_paid
       FROM invoices i
       WHERE i.patient_id = $1
       ORDER BY i.invoice_date DESC`,
      [patientId]
    );

    const paymentsResult = await pool.query(
      `SELECT p.payment_id, p.invoice_id, p.amount_paid, p.payment_method, p.paid_at
       FROM payments p
       JOIN invoices i ON p.invoice_id = i.invoice_id
       WHERE i.patient_id = $1
       ORDER BY p.paid_at DESC`,
      [patientId]
    );

    return res.status(200).json({
      invoices: invoicesResult.rows,
      payments: paymentsResult.rows,
    });
  } catch (err) {
    console.error('Fetch billing error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};
