/**
 * TADHack 2025 Integration Test
 * Verifies full flow: load vCons -> convert to cases -> API -> audio stream
 */
const axios = require('axios');
const tadhackLoader = require('../services/tadhackDataLoader');
const db = require('../models/Case');

const API_BASE = process.env.API_URL || 'http://localhost:8001';

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function runTests() {
  console.log('TADHack 2025 Integration Test\n');

  // 1. TADHack Data Loader - fetch and convert
  console.log('1. Testing tadhackDataLoader...');
  const cases = await tadhackLoader.loadAllCases();
  assert(cases.length > 0, `Expected cases, got ${cases.length}`);
  assert(cases.length >= 40, `Expected ~42 cases, got ${cases.length}`);

  const sample = cases[0];
  assert(sample.caseId?.startsWith('tadhack_'), 'Case ID should start with tadhack_');
  assert(sample.source === 'tadhack_2025_dataset', 'Source should be tadhack_2025_dataset');
  assert(sample.tadhackMeta?.filename, 'Should have tadhackMeta.filename');
  assert(sample.tadhackMeta?.filePath, 'Should have tadhackMeta.filePath');
  assert(sample.touchpoints?.length > 0, 'Should have touchpoints');
  assert(sample.customer?.names?.length > 0, 'Should have customer names');

  console.log(`   OK: Loaded ${cases.length} cases, sample: ${sample.customer?.names?.[0]}`);

  // 2. Database insertion
  console.log('\n2. Testing database insertion...');
  const beforeCount = db.getAllCases().length;
  for (const c of cases.slice(0, 3)) {
    db.addTadhackCase(c);
  }
  const afterCount = db.getAllCases().length;
  assert(afterCount >= beforeCount + 3, `Expected +3 cases, got ${afterCount - beforeCount}`);

  const inserted = db.getCase(cases[0].caseId);
  assert(inserted !== null, 'Inserted case should be retrievable');
  assert(inserted.customer?.names, 'Case should have customer');
  console.log('   OK: Cases inserted and retrievable');

  // 3. API endpoints (requires server running)
  console.log('\n3. Testing API endpoints...');
  try {
    const healthRes = await axios.get(`${API_BASE}/health`, { timeout: 3000 });
    assert(healthRes.status === 200, 'Health check failed');

    const casesRes = await axios.get(`${API_BASE}/api/cases`, { timeout: 5000 });
    assert(Array.isArray(casesRes.data), 'Cases API should return array');
    const tadhackCases = casesRes.data.filter(c => c.source === 'tadhack_2025_dataset');
    console.log(`   OK: API returns ${casesRes.data.length} cases (${tadhackCases.length} TADHack)`);

    const loadRes = await axios.post(`${API_BASE}/api/tadhack/load`, {}, { timeout: 120000 });
    assert(loadRes.data?.loaded > 0, `Load should return count, got ${JSON.stringify(loadRes.data)}`);
    console.log(`   OK: POST /api/tadhack/load returned ${loadRes.data.loaded} cases`);

    const caseId = casesRes.data.find(c => c.source === 'tadhack_2025_dataset')?.caseId;
    if (caseId) {
      const detailRes = await axios.get(`${API_BASE}/api/cases/${caseId}`, { timeout: 5000 });
      const detail = detailRes.data;
      assert(detail.tadhackMeta, 'Case detail should have tadhackMeta');
      assert(detail.tadhackMeta.filePath, 'Should have filePath for audio');

      const audioPath = detail.tadhackMeta.filePath;
      const audioRes = await axios.get(`${API_BASE}/audio/tadhack-audio/${audioPath}`, {
        responseType: 'arraybuffer',
        timeout: 15000,
        validateStatus: (s) => s === 200
      });
      assert(audioRes.status === 200, `Audio stream failed: ${audioRes.status}`);
      assert(audioRes.data?.byteLength > 1000, 'Audio should have content');
      console.log(`   OK: GET /audio/tadhack-audio/:path streams MP3 (${audioRes.data.byteLength} bytes)`);
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.log('   SKIP: Server not running at', API_BASE);
    } else {
      throw err;
    }
  }

  console.log('\nAll tests passed.');
}

runTests().catch((err) => {
  console.error('\nTest failed:', err.message);
  process.exit(1);
});
