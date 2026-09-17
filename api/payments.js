// api/payments.js
// POST /api/payments — records a real payment against an invoice and
// updates that invoice's payment_status accordingly. received_by is
// set to the dedicated "Everwell Billing" system account (user_id 14),
// since this is a patient-initiated online payment with no staff
// member actually involved in receiving it.

const pool = require('../lib/db');

const ONLINE_PAYMENT_RECEIVER_ID = 14; // Everwell Billing (Billing Staff role)

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { invoiceId, patientId, amountPaid, paymentMethod } = req.body;

  if (!invoiceId || !patientId || !amountPaid || !paymentMethod) {
    return res.status(400).json({ error: 'invoiceId, patientId, amountPaid, and paymentMethod are required' });
  }

  const amount = Number(amountPaid);
  if (!(amount > 0)) {
    return res.status(400).json({ error: 'amountPaid must be greater than 0' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invoiceResult = await client.query(
      `SELECT i.invoice_id, i.total_amount, i.payment_status,
              COALESCE((SELECT SUM(p.amount_paid) FROM payments p WHERE p.invoice_id = i.invoice_id), 0) AS already_paid
       FROM invoices i
       WHERE i.invoice_id = $1 AND i.patient_id = $2
       FOR UPDATE`,
      [invoiceId, patientId]
    );

    if (invoiceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];
    if (invoice.payment_status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This invoice is already fully paid' });
    }

    const remaining = Number(invoice.total_amount) - Number(invoice.already_paid);
    if (amount > remaining + 0.01) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Amount exceeds the remaining balance of ${remaining.toFixed(2)}` });
    }

    await client.query(
      `INSERT INTO payments (invoice_id, amount_paid, payment_method, received_by, paid_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [invoiceId, amount, paymentMethod, ONLINE_PAYMENT_RECEIVER_ID]
    );

    const newTotalPaid = Number(invoice.already_paid) + amount;
    const newStatus = newTotalPaid >= Number(invoice.total_amount) - 0.01 ? 'paid' : 'partial';

    await client.query(
      `UPDATE invoices SET payment_status = $1 WHERE invoice_id = $2`,
      [newStatus, invoiceId]
    );

    await client.query('COMMIT');
    return res.status(201).json({ message: 'Payment recorded', newStatus, remaining: Math.max(Number(invoice.total_amount) - newTotalPaid, 0) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Process payment error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  } finally {
    client.release();
  }
};