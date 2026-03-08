const { v4: uuidv4 } = require('uuid');
const db = require('../models/Case');
const conserver = require('./conserver');

class UnificationService {
  async processVcon(vcon) {
    // Extract identity from vCon parties
    const identity = this.extractIdentity(vcon);
    
    // Find or create customer
    const customer = db.findOrCreateCustomer(identity);
    
    // Build touchpoint
    const touchpoint = this.buildTouchpoint(vcon);
    
    // Find existing case or create new
    let caseData = db.findActiveCaseForCustomer(customer.customerId);
    
    if (!caseData) {
      caseData = db.createCase(customer.customerId, touchpoint);
      caseData.source = 'africastalking';
      console.log(`Created new case: ${caseData.caseId}`);
    } else {
      caseData = db.addTouchpoint(caseData.caseId, touchpoint);
      if (!caseData.source) caseData.source = 'africastalking';
      console.log(`Added to existing case: ${caseData.caseId}`);
    }
    
    // Enrich with customer data for response
    return {
      ...caseData,
      customer
    };
  }

  extractIdentity(vcon) {
    const parties = vcon.parties || [];
    
    let email = null;
    let phone = null;
    let name = null;
    
    for (const party of parties) {
      if (party.mailto) email = party.mailto;
      if (party.tel) phone = party.tel;
      if (party.name) name = party.name;
    }
    
    return { email, phone, name };
  }

  buildTouchpoint(vcon) {
    const dialog = vcon.dialog?.[0] || {};
    const analysis = vcon.analysis || [];
    
    // Extract analysis data
    let sentimentScore = 0;
    let summary = '';
    let keyEntities = [];
    
    for (const a of analysis) {
      if (a.type === 'sentiment') sentimentScore = parseFloat(a.body) || 0;
      if (a.type === 'summary') summary = a.body;
      if (a.type === 'entities') {
        try {
          keyEntities = JSON.parse(a.body);
        } catch (e) {
          keyEntities = [];
        }
      }
    }
    
    // Detect channel
    let channel = 'sms';
    const mimetype = dialog.mimetype || '';
    if (mimetype.includes('audio') || dialog.type === 'recording') {
      channel = 'voice';
    } else if (dialog.type === 'text' || dialog.body) {
      channel = 'sms';
    }
    
    // Get transcript/body
    const transcriptSnippet = dialog.body || dialog.transcript || '';
    
    return {
      vconUuid: vcon.uuid,
      channel,
      timestamp: vcon.created_at || new Date().toISOString(),
      participants: vcon.parties || [],
      summary,
      sentimentScore,
      keyEntities,
      recordingUrl: dialog.url || null,
      transcriptSnippet: transcriptSnippet.substring(0, 200)
    };
  }

  buildVconFromCall(recordingInfo) {
    return {
      uuid: `at_call_${recordingInfo.sessionId}_${uuidv4()}`,
      vcon: '0.0.1',
      created_at: recordingInfo.timestamp,
      parties: [
        {
          name: 'Customer',
          tel: recordingInfo.callerNumber,
          role: 'customer'
        },
        {
          name: 'Support Line',
          tel: process.env.AT_FROM_NUMBER,
          role: 'agent'
        }
      ],
      dialog: [
        {
          type: 'recording',
          start: recordingInfo.timestamp,
          duration: recordingInfo.duration,
          parties: [0, 1],
          url: recordingInfo.recordingUrl,
          mimetype: 'audio/mp3',
          filename: `call_${recordingInfo.sessionId}.mp3`
        }
      ],
      analysis: [],
      attachments: [],
      tags: ['africas_talking', 'voice', 'inbound']
    };
  }

  buildVconFromSMS(smsInfo) {
    return {
      uuid: `at_sms_${smsInfo.messageId}_${uuidv4()}`,
      vcon: '0.0.1',
      created_at: smsInfo.timestamp,
      parties: [
        {
          name: 'Customer',
          tel: smsInfo.from,
          role: 'customer'
        },
        {
          name: 'Support Line',
          tel: smsInfo.to,
          role: 'agent'
        }
      ],
      dialog: [
        {
          type: 'text',
          start: smsInfo.timestamp,
          duration: 0,
          parties: [0],
          body: smsInfo.text,
          encoding: 'utf-8'
        }
      ],
      analysis: [],
      attachments: [],
      tags: ['africas_talking', 'sms', 'inbound']
    };
  }
}

module.exports = new UnificationService();