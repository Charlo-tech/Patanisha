const express = require('express');
const router = express.Router();

const db = require('../models/Case');
const atService = require('../services/africastalking');

// List all cases
router.get('/', (req, res) => {
  const filters = {
    status: req.query.status,
    priority: req.query.priority
  };
  
  const cases = db.getAllCases(filters).map(c => ({
    ...c,
    customer: db.customers.get(c.customerId)
  }));
  
  res.json(cases);
});

// Get single case
router.get('/:caseId', (req, res) => {
  const caseData = db.getCase(req.params.caseId);
  if (!caseData) {
    return res.status(404).json({ error: 'Case not found' });
  }
  res.json(caseData);
});

// Claim case
router.post('/:caseId/claim', (req, res) => {
  const { agentId } = req.query;
  const caseData = db.updateCase(req.params.caseId, {
    assignedAgent: agentId,
    status: 'in_progress'
  });
  
  if (!caseData) {
    return res.status(404).json({ error: 'Case not found' });
  }
  
  res.json({ status: 'claimed', agentId });
});

// Send SMS reply
router.post('/:caseId/reply', async (req, res) => {
  const { message } = req.query;
  const caseData = db.getCase(req.params.caseId);
  
  if (!caseData) {
    return res.status(404).json({ error: 'Case not found' });
  }
  
  const phone = caseData.customer?.phones?.[0];
  if (!phone) {
    return res.status(400).json({ error: 'No phone number for customer' });
  }
  
  // Send via Africa's Talking
  const result = await atService.sendSMS(phone, message);
  
  if (result.success) {
    // Add to case as touchpoint
    const touchpoint = {
      vconUuid: `sms_reply_${Date.now()}`,
      channel: 'sms',
      timestamp: new Date().toISOString(),
      participants: [{ name: 'Agent', role: 'agent' }],
      summary: `Agent reply: ${message.substring(0, 50)}`,
      sentimentScore: 0,
      keyEntities: [],
      recordingUrl: null,
      transcriptSnippet: message
    };
    
    db.addTouchpoint(req.params.caseId, touchpoint);
    
    res.json({ status: 'sent', messageId: result.messageId });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// Resolve case
router.post('/:caseId/resolve', async (req, res) => {
  const { resolution } = req.query;
  
  const caseData = db.updateCase(req.params.caseId, {
    status: 'resolved',
    resolution
  });
  
  if (!caseData) {
    return res.status(404).json({ error: 'Case not found' });
  }
  
  // Send SMS to customer
  const phone = caseData.customer?.phones?.[0];
  if (phone) {
    const message = `Your support case has been resolved. Reference: ${req.params.caseId}`;
    await atService.sendSMS(phone, message);
  }
  
  res.json({ status: 'resolved' });
});

module.exports = router;