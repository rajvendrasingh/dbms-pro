require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// ── Middleware ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
// Works both locally (backend/) and on Railway (project root)
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// ── API Routes ──────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/challans',   require('./routes/challans'));
app.use('/api/vehicles',   require('./routes/vehicles'));
app.use('/api/officers',   require('./routes/officers'));
app.use('/api/violations', require('./routes/violations'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Traffic Challan API running', time: new Date() });
});

// ── Fallback: serve frontend for any non-API route ──────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Global error handler ────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚦 Traffic Challan System`);
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
