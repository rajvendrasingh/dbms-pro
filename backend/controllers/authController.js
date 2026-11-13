const db      = require('../config/db');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password required.' });

  try {
    const [rows] = await db.execute(
      `SELECT o.*, z.zone_name, z.city
       FROM officers o
       LEFT JOIN zones z ON o.zone_id = z.zone_id
       WHERE o.email = ? AND o.is_active = 1`,
      [email]
    );
    if (rows.length === 0)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const officer = rows[0];
    const match   = await bcrypt.compare(password, officer.password_hash);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const token = jwt.sign(
      {
        officer_id:   officer.officer_id,
        badge_number: officer.badge_number,
        full_name:    officer.full_name,
        email:        officer.email,
        rank:         officer.rank,
        zone_id:      officer.zone_id,
        zone_name:    officer.zone_name
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Audit log
    await db.execute(
      `INSERT INTO audit_log(officer_id, action, details, ip_address)
       VALUES(?, 'LOGIN', ?, ?)`,
      [officer.officer_id, `Login by ${officer.full_name}`, req.ip]
    );

    const { password_hash, ...officerData } = officer;
    res.json({ success: true, token, officer: officerData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/auth/change-password
const changePassword = async (req, res) => {
  const { old_password, new_password } = req.body;
  const officer_id = req.officer.officer_id;

  if (!old_password || !new_password)
    return res.status(400).json({ success: false, message: 'Both passwords required.' });
  if (new_password.length < 6)
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });

  try {
    const [rows] = await db.execute('SELECT password_hash FROM officers WHERE officer_id=?', [officer_id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Officer not found.' });

    const match = await bcrypt.compare(old_password, rows[0].password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Old password incorrect.' });

    const hash = await bcrypt.hash(new_password, 10);
    await db.execute('UPDATE officers SET password_hash=? WHERE officer_id=?', [hash, officer_id]);
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT o.officer_id, o.badge_number, o.full_name, o.email, o.phone,
              o.rank, o.is_active, o.created_at, z.zone_name, z.city
       FROM officers o
       LEFT JOIN zones z ON o.zone_id = z.zone_id
       WHERE o.officer_id = ?`,
      [req.officer.officer_id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, officer: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { login, changePassword, getMe };
