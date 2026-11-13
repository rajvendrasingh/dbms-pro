const jwt = require('jsonwebtoken');

/**
 * Verifies JWT token from Authorization header.
 * Attaches decoded officer info to req.officer
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.officer = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
  }
};

/**
 * Restricts access to SP / DSP / Inspector ranks only (admin-level)
 */
const requireAdmin = (req, res, next) => {
  const adminRanks = ['SP', 'DSP', 'Inspector'];
  if (!req.officer || !adminRanks.includes(req.officer.rank)) {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  next();
};

module.exports = { verifyToken, requireAdmin };
