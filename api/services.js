// api/services.js
// GET /api/services — returns each service's real description,
// duration, and category info (main + sub), for the booking page's
// grouped display and tab filtering.
//
// Note: "Pharmacy Services" has no sub-category beneath it (unlike
// General Medical and Diagnostics, which do) — services sit directly
// under it. COALESCE handles that: when a service's category has no
// parent, that category itself IS the main category.

const pool = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await pool.query(
      `SELECT
         s.service_id, s.service_name, s.description, s.standard_price,
         s.estimated_duration_minutes,
         sub.category_name AS sub_category_name,
         COALESCE(main.category_name, sub.category_name) AS main_category_name
       FROM services s
       JOIN service_categories sub ON s.category_id = sub.category_id
       LEFT JOIN service_categories main ON sub.parent_category_id = main.category_id
       WHERE s.is_active = TRUE
       ORDER BY main_category_name, sub.category_name, s.service_name`
    );
    return res.status(200).json({ count: result.rows.length, services: result.rows });
  } catch (err) {
    console.error('Fetch services error:', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
};
