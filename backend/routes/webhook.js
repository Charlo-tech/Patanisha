const express = require('express');
const router = express.Router();

const atService = require('../services/africastalking');
const conserver = require('../services/conserver');
const unification = require('../services/unification');

// Africa's Talking Voice - Incoming Call
router.post('/at/voice/incoming', (req, res) => {
  const xml = atService.handleIncomingCall(req.body);
  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

// Africa's Talking Voice - Recording Complete
router.post('/at/voice/recorded', async (req, res) => {
  try {
    console.log('🎙️ Recording received:', req.body.recordingUrl);
    
    // Get recording info
    const recordingInfo = atService.handleRecording(req.body);
    
    // Build vCon
    const vcon = unification.buildVconFromCall(recordingInfo);
    
    // Send to conserver (or simulate)
    let processedVcon;
    try {
      const uuid = await conserver.ingestVcon(vcon);
      await new Promise(r => setTimeout(r, 2000)); // Wait for processing
      processedVcon = await conserver.getVcon(uuid);
    } catch (e) {
      console.log('Using simulated processing');
      processedVcon = conserver.simulateProcessing(vcon);
    }
    
    // Unify into case
    const caseData = await unification.processVcon(processedVcon);
    
    res.json({ status: 'processed', caseId: caseData.caseId });
  } catch (error) {
    console.error('Voice processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Africa's Talking SMS - Incoming
router.post('/at/sms/incoming', async (req, res) => {
  try {
    console.log('📩 SMS from', req.body.from, ':', req.body.text?.substring(0, 50));
    
    // Parse SMS
    const smsInfo = atService.handleIncomingSMS(req.body);
    
    // Build vCon
    const vcon = unification.buildVconFromSMS(smsInfo);
    
    // Process through conserver (or simulate)
    let processedVcon;
    try {
      const uuid = await conserver.ingestVcon(vcon);
      await new Promise(r => setTimeout(r, 1000));
      processedVcon = await conserver.getVcon(uuid);
    } catch (e) {
      console.log('Using simulated processing');
      processedVcon = conserver.simulateProcessing(vcon);
    }
    
    // Unify into case
    const caseData = await unification.processVcon(processedVcon);
    
    res.json({ status: 'received', caseId: caseData.caseId });
  } catch (error) {
    console.error('SMS processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;