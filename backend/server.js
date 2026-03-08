const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const webhookRoutes = require('./routes/webhook');
const caseRoutes = require('./routes/cases');
const tadhackLoader = require('./services/tadhackDataLoader');
const audioRoutes = require('./routes/audio');
const simulateRoutes = require('./routes/simulate');
const db = require('./models/Case');


const app = express();
const PORT = process.env.PORT || 8001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API routes first (before static, so /api/* always hits backend)
app.use('/webhooks', webhookRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/simulate', simulateRoutes);
app.use('/audio', audioRoutes);

// Serve dashboard (open http://localhost:8001/ to use)
app.use(express.static(path.join(__dirname, '../dashboard')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../dashboard/index.html')));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'UnifiedCase API'
  });
});

app.post('/api/tadhack/load', async (req, res) => {
  try {
    const cases = await tadhackLoader.loadAllCases();

    for (const caseData of cases) {
      db.addTadhackCase(caseData);
    }

    res.json({
      loaded: cases.length,
      message: 'TADHack 2025 data loaded successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// 404 for API routes - return JSON not HTML
app.use((req, res, next) => {
  if (req.path.startsWith('/api') && !res.headersSent) {
    return res.status(404).json({ error: 'Not found', path: req.path });
  }
  next();
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, async () => {
  console.log(`
UnifiedCase Backend Running
==============================
Port: ${PORT}
API: http://localhost:${PORT}
Health: http://localhost:${PORT}/health
  `);

  try {
    console.log('Loading TADHack 2025 dataset...');
    const cases = await tadhackLoader.loadAllCases();
    for (const caseData of cases) {
      db.addTadhackCase(caseData);
    }
    console.log(`Pre-loaded ${cases.length} TADHack cases`);
  } catch (err) {
    console.warn('TADHack pre-load skipped:', err.message);
  }
});