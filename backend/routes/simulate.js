const express = require('express');
const router = express.Router();
const simulator = require('../services/simulator');
const atService = require('../services/africastalking');
const unification = require('../services/unification');
const conserver = require('../services/conserver');
const db = require('../models/Case');

/**
 * Simulate Africa's Talking webhooks without real AT integration.
 * Creates cases through the same pipeline as real calls/SMS.
 * Batch mode creates one case per customer with voice, SMS thread, and emails.
 */

// Health check - verify route is reachable
router.get('/health', (req, res) => res.json({ ok: true, service: 'simulate' }));

async function processSimulatedSms(payload) {
  const smsInfo = atService.handleIncomingSMS(payload);
  const vcon = unification.buildVconFromSMS(smsInfo);
  const processedVcon = conserver.simulateProcessing(vcon);
  return unification.processVcon(processedVcon);
}

async function processSimulatedVoice(payload, scenario = 'inquiry') {
  const recordingInfo = atService.handleRecording(payload);
  const vcon = unification.buildVconFromCall(recordingInfo);
  // Add call summary for analysis (voice has no transcript, so we inject scenario summary)
  vcon.analysis = [{ type: 'summary', body: simulator.VOICE_SUMMARIES[scenario] || simulator.VOICE_SUMMARIES.inquiry }];
  const processedVcon = conserver.simulateProcessing(vcon);
  return unification.processVcon(processedVcon);
}

// Simulate single SMS
router.post('/sms', async (req, res) => {
  try {
    const { from, text, scenario } = req.body;
    const customer = (from && simulator.SAMPLE_CUSTOMERS.find(c => c.phone === from))
      || simulator.SAMPLE_CUSTOMERS[0];
    const payload = simulator.generateSmsPayload(
      customer,
      scenario || 'inquiry'
    );
    if (from) payload.from = from;
    if (text) payload.text = text;

    const caseData = await processSimulatedSms(payload);
    res.json({ status: 'simulated', caseId: caseData.caseId, case: caseData });
  } catch (error) {
    console.error('Simulate SMS error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simulate single voice call
router.post('/voice', async (req, res) => {
  try {
    const { from } = req.body;
    const customer = (from && simulator.SAMPLE_CUSTOMERS.find(c => c.phone === from))
      || simulator.SAMPLE_CUSTOMERS[0];
    const payload = simulator.generateVoicePayload(customer, req.body.scenario || 'inquiry');
    if (from) payload.callerNumber = from;

    const caseData = await processSimulatedVoice(payload);
    res.json({ status: 'simulated', caseId: caseData.caseId, case: caseData });
  } catch (error) {
    console.error('Simulate voice error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simulate batch - one case per customer with voice, SMS thread, and emails
router.post('/batch', async (req, res) => {
  try {
    const { count = 10 } = req.body;
    const fullCases = simulator.generateFullCases(Math.min(count, 10));
    const added = [];

    for (const caseData of fullCases) {
      db.addTadhackCase(caseData);
      added.push({
        caseId: caseData.caseId,
        customer: caseData.customer?.names?.[0],
        touchpoints: caseData.touchpoints?.length || 0,
      });
    }

    res.json({
      status: 'simulated',
      total: added.length,
      cases: added,
    });
  } catch (error) {
    console.error('Simulate batch error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
