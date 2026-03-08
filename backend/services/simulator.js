/**
 * Africa's Talking Simulator
 * Generates sample SMS and voice call data for testing and analysis
 */

const SAMPLE_CUSTOMERS = [
  { name: 'James Ochieng', phone: '+254711234567', email: 'james.ochieng@example.com', scenarios: ['order', 'complaint', 'refund'] },
  { name: 'Mary Wanjiku', phone: '+254722345678', email: 'mary.wanjiku@example.com', scenarios: ['shipping', 'inquiry'] },
  { name: 'Peter Kamau', phone: '+254733456789', email: 'peter.kamau@example.com', scenarios: ['complaint', 'urgent'] },
  { name: 'Grace Akinyi', phone: '+254744567890', email: 'grace.akinyi@example.com', scenarios: ['refund', 'order'] },
  { name: 'David Mwangi', phone: '+254755678901', email: 'david.mwangi@example.com', scenarios: ['inquiry', 'appointment'] },
  { name: 'Sarah Njeri', phone: '+254766789012', email: 'sarah.njeri@example.com', scenarios: ['complaint'] },
  { name: 'John Otieno', phone: '+254777890123', email: 'john.otieno@example.com', scenarios: ['shipping', 'order'] },
  { name: 'Lucy Adhiambo', phone: '+254788901234', email: 'lucy.adhiambo@example.com', scenarios: ['refund'] },
  { name: 'Michael Kipchoge', phone: '+254799012345', email: 'michael.kipchoge@example.com', scenarios: ['inquiry', 'shipping'] },
  { name: 'Jane Wambui', phone: '+254700123456', email: 'jane.wambui@example.com', scenarios: ['appointment', 'complaint'] },
];

const SMS_SCENARIOS = {
  order: [
    'Hi, I placed order #4521 three days ago but haven\'t received it. Can you check the status?',
    'My order 4521 was supposed to arrive yesterday. Where is it?',
    'I need an update on my order. Order number 4521.',
  ],
  complaint: [
    'This is unacceptable! I\'ve been waiting for 2 weeks. I want to speak to a manager.',
    'Very frustrated with your service. The product I received was damaged.',
    'I am extremely angry. Your support has been unhelpful. I need this resolved NOW.',
  ],
  refund: [
    'I would like to request a refund for order 3892. The item was defective.',
    'Please process my refund. Order 3892. Item didn\'t work as described.',
    'How do I get a refund? I want to return the product from order 3892.',
  ],
  shipping: [
    'When will my package arrive? Tracking shows it\'s been stuck for 3 days.',
    'Can you update the delivery address for my order? Moving to a new place.',
    'What are the shipping options to Mombasa? Need it by Friday.',
  ],
  inquiry: [
    'What are your business hours? I\'d like to visit your office.',
    'Do you have the product in stock? Looking for model X-200.',
    'Can I pay with M-Pesa? What are the payment options?',
  ],
  appointment: [
    'I need to schedule a consultation for next week. Tuesday or Wednesday works.',
    'Can I book an appointment for tomorrow afternoon?',
    'I\'d like to come in for a demo. When are you available?',
  ],
  urgent: [
    'URGENT: My account is locked and I need access immediately!',
    'ASAP - Critical issue with my subscription. Please call me back.',
    'Emergency - I need help right now. Account compromised.',
  ],
};

const VOICE_SUMMARIES = {
  order: 'Customer called regarding order #4521. Agent verified delivery status and provided updated tracking. Customer confirmed address. Estimated delivery in 2 business days.',
  complaint: 'Customer expressed frustration with delayed order and damaged packaging. Requested manager callback. Agent apologized and offered expedited replacement. Customer agreed to resolution.',
  refund: 'Customer requested refund for order 3892 due to defective item. Agent verified order details, initiated return process. Refund to be processed within 5-7 business days to original payment method.',
  shipping: 'Customer inquired about shipping to Mombasa. Agent quoted rates and transit times. Customer requested address change for in-transit order. Agent updated delivery details.',
  inquiry: 'Customer had questions about product availability and M-Pesa payment options. Agent provided stock levels and payment instructions. Customer thanked agent and ended call.',
  appointment: 'Customer wanted to schedule yacht viewing for next week. Agent checked calendar, offered Tuesday 2pm or Wednesday 10am. Customer booked Tuesday slot. Confirmation sent via SMS.',
  urgent: 'Customer reported account locked after failed login attempts. Agent verified identity, reset password. Customer regained access. Advised to enable 2FA for security.',
};

const EMAIL_SCENARIOS = {
  support: [
    { subject: 'Support Request - Order #4521', body: 'Hello, I am writing to follow up on my order #4521. I have not received any update on the delivery status. Could you please provide a tracking number or estimated delivery date? Thank you.' },
    { subject: 'Issue with my recent purchase', body: 'I received my order but the product was damaged during shipping. I would like to request a replacement or refund. Order reference: 3892. Please advise on next steps.' },
    { subject: 'Account access issue', body: 'I am unable to log into my account. I have tried resetting my password but have not received the reset email. Could you assist me with regaining access? My registered email is the one I am writing from.' },
  ],
  feedback: [
    { subject: 'Feedback on your service', body: 'I wanted to share my experience. The agent I spoke with was very helpful and resolved my issue quickly. However, the initial wait time was quite long. Overall satisfied with the outcome.' },
    { subject: 'Suggestion for improvement', body: 'I have been a customer for 2 years. It would be helpful if you could add SMS notifications for order status updates. Many of us prefer text over email for quick updates.' },
    { subject: 'Thank you for the support', body: 'Just wanted to say thank you for the excellent support I received yesterday. The refund was processed faster than expected. I will continue to recommend your services.' },
  ],
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomId() {
  return `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate simulated SMS payload (matches Africa's Talking webhook format)
 */
function generateSmsPayload(customer, scenario) {
  const text = pickRandom(SMS_SCENARIOS[scenario] || SMS_SCENARIOS.inquiry);
  return {
    id: randomId(),
    from: customer.phone,
    to: process.env.AT_FROM_NUMBER || '+254711082000',
    text,
    date: new Date().toISOString(),
    networkCode: '63902',
  };
}

/**
 * Generate simulated voice recording payload (matches Africa's Talking webhook format)
 */
function generateVoicePayload(customer, scenario) {
  return {
    sessionId: randomId(),
    callerNumber: customer.phone,
    recordingUrl: `https://example.com/recordings/${randomId()}.mp3`,
    durationInSeconds: String(30 + Math.floor(Math.random() * 90)),
    isActive: 'false',
  };
}

/**
 * Simulate N SMS interactions
 */
function generateSmsBatch(count = 5) {
  const payloads = [];
  for (let i = 0; i < count; i++) {
    const customer = pickRandom(SAMPLE_CUSTOMERS);
    const scenario = pickRandom(customer.scenarios);
    payloads.push({
      customer,
      scenario,
      payload: generateSmsPayload(customer, scenario),
    });
  }
  return payloads;
}

/**
 * Simulate N voice call recordings
 */
function generateVoiceBatch(count = 3) {
  const payloads = [];
  for (let i = 0; i < count; i++) {
    const customer = pickRandom(SAMPLE_CUSTOMERS);
    const scenario = pickRandom(customer.scenarios);
    payloads.push({
      customer,
      scenario,
      payload: generateVoicePayload(customer, scenario),
    });
  }
  return payloads;
}

/**
 * Generate simulated email payload (support or feedback)
 */
function generateEmailPayload(customer, type = 'support') {
  const scenarios = EMAIL_SCENARIOS[type] || EMAIL_SCENARIOS.support;
  const { subject, body } = pickRandom(scenarios);
  return {
    id: randomId(),
    from: customer.email,
    to: 'support@example.com',
    subject,
    body,
    date: new Date().toISOString(),
  };
}

/**
 * Generate full cases: one case per customer with name, number, email,
 * and touchpoints: voice calls, SMS thread, and emails.
 */
function generateFullCases(count = 10) {
  const cases = [];
  const used = new Set();
  let attempts = 0;
  const maxAttempts = count * 3;

  while (cases.length < count && attempts < maxAttempts) {
    const customer = pickRandom(SAMPLE_CUSTOMERS);
    if (used.has(customer.phone)) {
      attempts++;
      continue;
    }
    used.add(customer.phone);
    attempts = 0;

    const baseTime = Date.now() - Math.random() * 48 * 60 * 60 * 1000; // last 48h
    const touchpoints = [];

    // 1-2 voice calls
    const voiceCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < voiceCount; i++) {
      const scenario = pickRandom(customer.scenarios);
      touchpoints.push({
        channel: 'voice',
        timestamp: new Date(baseTime + i * 2 * 60 * 60 * 1000).toISOString(),
        summary: VOICE_SUMMARIES[scenario] || VOICE_SUMMARIES.inquiry,
        transcriptSnippet: '',
        sentimentScore: (Math.random() - 0.3) * 2,
        recordingUrl: `https://example.com/recordings/${randomId()}.mp3`,
        vconUuid: `sim_voice_${randomId()}`,
        participants: [],
      });
    }

    // 2-4 SMS messages (thread)
    const smsCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < smsCount; i++) {
      const scenario = pickRandom(customer.scenarios);
      const text = pickRandom(SMS_SCENARIOS[scenario] || SMS_SCENARIOS.inquiry);
      touchpoints.push({
        channel: 'sms',
        timestamp: new Date(baseTime + (voiceCount + i) * 45 * 60 * 1000).toISOString(),
        summary: text.substring(0, 80) + (text.length > 80 ? '...' : ''),
        transcriptSnippet: text,
        sentimentScore: (Math.random() - 0.3) * 2,
        vconUuid: `sim_sms_${randomId()}`,
        participants: [],
      });
    }

    // 1-2 emails (support or feedback)
    const emailCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < emailCount; i++) {
      const type = Math.random() > 0.5 ? 'support' : 'feedback';
      const { subject, body } = generateEmailPayload(customer, type);
      touchpoints.push({
        channel: 'email',
        timestamp: new Date(baseTime + (voiceCount + smsCount + i) * 90 * 60 * 1000).toISOString(),
        summary: subject,
        transcriptSnippet: body,
        sentimentScore: type === 'feedback' ? 0.5 + Math.random() * 0.5 : (Math.random() - 0.2) * 2,
        vconUuid: `sim_email_${randomId()}`,
        participants: [],
      });
    }

    touchpoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const customerId = `cust_sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const caseId = `case_sim_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    cases.push({
      caseId,
      customerId,
      customer: {
        customerId,
        names: [customer.name],
        phones: [customer.phone],
        emails: [customer.email],
      },
      status: 'open',
      priority: 3,
      source: 'africastalking',
      createdAt: touchpoints[0].timestamp,
      updatedAt: touchpoints[touchpoints.length - 1].timestamp,
      assignedAgent: null,
      touchpoints,
      tags: [],
      collisionAlert: false,
      sentimentJourney: touchpoints.map(tp => ({ time: tp.timestamp, sentiment: tp.sentimentScore || 0, channel: tp.channel })),
    });
  }

  return cases;
}

module.exports = {
  generateSmsPayload,
  generateVoicePayload,
  generateEmailPayload,
  generateSmsBatch,
  generateVoiceBatch,
  generateFullCases,
  SAMPLE_CUSTOMERS,
  SMS_SCENARIOS,
  VOICE_SUMMARIES,
  EMAIL_SCENARIOS,
};
