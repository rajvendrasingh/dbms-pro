const db     = require('../config/db');
const bcrypt = require('bcryptjs');

// GET /api/officers
const getAllOfficers = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT o.officer_id, o.badge_number, o.full_name, o.email,
              o.phone, o.rank, o.is_active, o.created_at,
              z.zone_name, z.city,
              COUNT(c.challan_id) AS total_challans
       FROM officers o
       LEFT JOIN zones z     ON o.zone_id = z.zone_id
       LEFT JOIN challans c  ON o.officer_id = c.officer_id
       GROUP BY o.officer_id
       ORDER BY o.full_name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/officers  — create new officer (admin only)
const createOfficer = async (req, res) => {
  const { badge_number, full_name, email, password, phone, zone_id, rank } = req.body;
  if (!badge_number || !full_name || !email || !password)
    return res.status(400).json({ success: false, message: 'badge_number, full_name, email, password required.' });

  try {
    const [dup] = await db.execute(
      'SELECT officer_id FROM officers WHERE email=? OR badge_number=?', [email, badge_number]
    );
    if (dup.length)
      return res.status(409).json({ success: false, message: 'Email or badge number already exists.' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      `INSERT INTO officers(badge_number, full_name, email, password_hash, phone, zone_id, rank)
       VALUES(?,?,?,?,?,?,?)`,
      [badge_number, full_name, email, hash, phone||null, zone_id||null, rank||'Constable']
    );
    res.status(201).json({ success: true, message: 'Officer created.', officer_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/officers/:id/stats
const getOfficerStats = async (req, res) => {
  try {
    const [[stats]] = await db.execute(
      `SELECT
         COUNT(*)                                            AS total_challans,
         SUM(fine_amount)                                   AS total_fines,
         SUM(CASE WHEN status='Paid' THEN fine_amount ELSE 0 END) AS collected,
         SUM(CASE WHEN status='Pending' THEN fine_amount ELSE 0 END) AS pending,
         COUNT(CASE WHEN status='Disputed' THEN 1 END)      AS disputed
       FROM challans WHERE officer_id = ?`,
      [req.params.id]
    );
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/officers/:id
const updateOfficer = async (req, res) => {
  const { full_name, phone, zone_id, rank, is_active } = req.body;
  try {
    await db.execute(
      `UPDATE officers SET
         full_name  = COALESCE(?, full_name),
         phone      = COALESCE(?, phone),
         zone_id    = COALESCE(?, zone_id),
         rank       = COALESCE(?, rank),
         is_active  = COALESCE(?, is_active)
       WHERE officer_id = ?`,
      [full_name||null, phone||null, zone_id||null, rank||null, is_active??null, req.params.id]
    );
    res.json({ success: true, message: 'Officer updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getAllOfficers, createOfficer, getOfficerStats, updateOfficer };
