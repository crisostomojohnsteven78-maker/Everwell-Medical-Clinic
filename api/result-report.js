// api/result-report.js
// GET /api/result-report?appointmentServiceId=8
// Generates a PDF result report on the fly from real data — no file
// storage needed. Only works for services that are actually marked
// 'completed' (with a result); anything else returns an honest error
// instead of a fabricated report. Clearly labeled as a sample/demo
// document throughout, never styled to look like a real diagnostic
// image or an official, legally-issued report.

const pool = require('../lib/db');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

function wrapText(text, font, size, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function buildReportPdf(data) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  let y = height - 60;

  page.drawText('EVERWELL MEDICAL CLINIC', { x: 50, y, size: 18, font: bold, color: rgb(0.15, 0.25, 0.2) });
  y -= 20;
  page.drawText('Diagnostic Result Report', { x: 50, y, size: 11, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 35;

  page.drawRectangle({ x: 50, y: y - 22, width: width - 100, height: 30, color: rgb(0.98, 0.93, 0.85), borderColor: rgb(0.75, 0.55, 0.2), borderWidth: 1 });
  page.drawText('SAMPLE DOCUMENT — FOR DEMONSTRATION PURPOSES ONLY. NOT A REAL MEDICAL RECORD.', { x: 60, y: y - 13, size: 9, font: bold, color: rgb(0.55, 0.35, 0.05) });
  y -= 55;

  const rows = [
    ['Patient', data.patientName],
    ['Test / Service', data.serviceName],
    ['Ordering Physician', data.doctorName],
    ['Visit Date', data.visitDate],
    ['Result Status', data.status],
    ['Resulted On', data.resultedOn],
  ];
  for (const [label, value] of rows) {
    page.drawText(label + ':', { x: 50, y, size: 10, font: bold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(String(value), { x: 190, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 20;
  }

  y -= 15;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 25;

  page.drawText('FINDINGS / RESULT SUMMARY', { x: 50, y, size: 11, font: bold, color: rgb(0.2, 0.35, 0.28) });
  y -= 20;

  const lines = wrapText(data.summary, font, 11, width - 100);
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 16;
  }

  y -= 30;
  page.drawText('This report was generated automatically for demo/testing purposes and does not represent an actual', { x: 50, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  y -= 11;
  page.drawText('diagnostic image or clinical finding.', { x: 50, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) });

  return doc.save();
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { appointmentServiceId } = req.query;
  if (!appointmentServiceId) {
    return res.status(400).json({ error: 'appointmentServiceId is required' });
  }

  try {
    const result = await pool.query(
      `SELECT
         aps.status, aps.result_summary, aps.resulted_at,
         s.service_name,
         a.scheduled_at,
         u.full_name AS doctor_name,
         p.first_name, p.last_name
       FROM appointment_services aps
       JOIN services s ON aps.service_id = s.service_id
       JOIN appointments a ON aps.appointment_id = a.appointment_id
       JOIN users u ON a.doctor_id = u.user_id
       JOIN patients p ON a.patient_id = p.patient_id
       WHERE aps.appointment_service_id = $1`,
      [appointmentServiceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Result not found' });
    }

    const row = result.rows[0];

    if (row.status !== 'completed') {
      return res.status(400).json({ error: 'This result has not been completed yet — no report available.' });
    }

    const pdfBytes = await buildReportPdf({
      patientName: `${row.first_name} ${row.last_name}`,
      serviceName: row.service_name,
      doctorName: row.doctor_name,
      visitDate: new Date(row.scheduled_at).toLocaleDateString(),
      status: 'Completed',
      resultedOn: row.resulted_at ? new Date(row.resulted_at).toLocaleDateString() : 'Not recorded',
      summary: row.result_summary || 'No written summary was entered for this result.',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="result-report-${appointmentServiceId}.pdf"`);
    return res.status(200).send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Generate result report error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};
