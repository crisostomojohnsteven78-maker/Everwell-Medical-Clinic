// api/invoices/[id].js
// GET    /api/invoices/5  -> view one invoice with all its line items
// PUT    /api/invoices/5  -> update payment_status (e.g. mark paid/partial)
// DELETE /api/invoices/5  -> void the invoice (never hard-deleted — invoices
//                            are financial records, same rule as clinical ones)

const pool = require('../../lib/db');

module.exports = async (req, res) => {
  const { id } = req.query;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'A valid invoice id is required' });
  }

  if (req.method === 'GET') {
    try {
      const invoiceResult = await pool.query(
        `SELECT i.*, p.first_name AS patient_first_name, p.last_name AS patient_last_name
         FROM invoices i
         JOIN patients p ON i.patient_id = p.patient_id
         WHERE i.invoice_id = $1`,
        [id]
      );

      if (invoiceResult.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const itemsResult = await pool.query(
        'SELECT * FROM invoice_items WHERE invoice_id = $1',
        [id]
      );

      return res.status(200).json({
        invoice: invoiceResult.rows[0],
        items: itemsResult.rows,
      });
    } catch (err) {
      console.error('Fetch invoice error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  if (req.method === 'PUT') {
    const { paymentStatus } = req.body;

    if (!paymentStatus) {
      return res.status(400).json({ error: 'paymentStatus is required' });
    }

    try {
      const result = await pool.query(
        `UPDATE invoices SET payment_status = $1 WHERE invoice_id = $2 RETURNING *`,
        [paymentStatus, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      return res.status(200).json({ message: 'Invoice updated', invoice: result.rows[0] });
    } catch (err) {
      console.error('Update invoice error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const result = await pool.query(
        `UPDATE invoices SET payment_status = 'void' WHERE invoice_id = $1 RETURNING invoice_id`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      return res.status(200).json({ message: 'Invoice voided' });
    } catch (err) {
      console.error('Void invoice error:', err);
      return res.status(500).json({ error: 'Something went wrong, please try again' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
