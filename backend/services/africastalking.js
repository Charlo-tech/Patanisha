const AfricasTalking = require('africastalking');

class AfricaTalkingService {
  constructor() {
    this.client = AfricasTalking({
      username: process.env.AT_USERNAME,
      apiKey: process.env.AT_API_KEY
    });
    
    this.voice = this.client.VOICE;
    this.sms = this.client.SMS;
    this.baseUrl = process.env.BASE_URL;
  }

  // Voice handling
  handleIncomingCall(callData) {
    const sessionId = callData.sessionId;
    const callerNumber = callData.callerNumber;
    
    console.log(`📞 Incoming call from: ${callerNumber}`);
    
    // Return XML for Africa's Talking
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Welcome to support. Your call is being recorded for quality.</Say>
    <Record 
        finishOnKey="#" 
        maxLength="600" 
        trimSilence="true"
        playBeep="true"
        callbackUrl="${this.baseUrl}/webhooks/at/voice/recorded"
    />
    <Say>Thank you. Goodbye.</Say>
</Response>`;
  }

  handleRecording(recordingData) {
    return {
      sessionId: recordingData.sessionId,
      callerNumber: recordingData.callerNumber,
      recordingUrl: recordingData.recordingUrl,
      duration: parseInt(recordingData.durationInSeconds) || 0,
      timestamp: new Date().toISOString()
    };
  }

  // SMS handling
  handleIncomingSMS(smsData) {
    return {
      messageId: smsData.id,
      from: smsData.from,
      to: smsData.to,
      text: smsData.text,
      timestamp: new Date().toISOString(),
      networkCode: smsData.networkCode
    };
  }

  async sendSMS(to, message) {
    try {
      const result = await this.sms.send({
        to: [to],
        message: message,
        from: process.env.AT_FROM_NUMBER
      });
      
      return {
        success: true,
        messageId: result.SMSMessageData.Recipients[0].messageId,
        cost: result.SMSMessageData.Recipients[0].cost
      };
    } catch (error) {
      console.error('SMS send error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new AfricaTalkingService();