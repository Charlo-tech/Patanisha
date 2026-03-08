const axios = require('axios');

/**
 * Conserver.io client with local fallback
 * - When CONSERVER_URL is set and reachable: submit vCons for processing
 * - When unavailable: use simulateProcessing for transcription, sentiment, entities
 */
class ConserverService {
  constructor() {
    this.baseURL = process.env.CONSERVER_URL || 'http://localhost:8000';
    this.apiKey = process.env.CONSERVER_API_KEY;
    this.enabled = !!process.env.CONSERVER_URL;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` })
      },
      validateStatus: () => true
    });
  }

  async isAvailable() {
    try {
      const res = await this.client.get('/api/v1/health');
      return res.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Ingest vCon to Conserver and optionally get enriched result
   * Falls back to local processing if Conserver unavailable
   */
  async ingestAndProcess(vcon) {
    if (!this.enabled) {
      return this.simulateProcessing(vcon);
    }

    try {
      const ingestRes = await this.client.post('/vcons', {
        vcon_data: vcon,
        validate_before_insert: false
      });

      if (ingestRes.status >= 200 && ingestRes.status < 300) {
        const uuid = ingestRes.data?.uuid || vcon.uuid;
        const getRes = await this.client.get(`/vcons/${uuid}`);
        if (getRes.status === 200 && getRes.data) {
          return getRes.data;
        }
      }

      return this.simulateProcessing(vcon);
    } catch (err) {
      console.warn('Conserver ingest failed:', err.message);
      return this.simulateProcessing(vcon);
    }
  }

  async ingestVcon(vcon) {
    try {
      const response = await this.client.post('/vcons', { vcon_data: vcon });
      return response.data?.uuid || vcon.uuid;
    } catch (error) {
      console.error('Conserver ingest error:', error.message);
      return vcon.uuid;
    }
  }

  async getVcon(uuid) {
    try {
      const response = await this.client.get(`/vcons/${uuid}`);
      return response.data;
    } catch (error) {
      console.error('Conserver get error:', error.message);
      return null;
    }
  }

  async queryVcons(params = {}) {
    try {
      const response = await this.client.get('/vcons', { params });
      return response.data;
    } catch (error) {
      console.error('Conserver query error:', error.message);
      return [];
    }
  }

  /**
   * Local fallback: enrich vCon with simulated sentiment and entities
   * TADHack vCons already have transcript/summary/diarized in analysis
   */
  simulateProcessing(vcon) {
    const dialog = vcon.dialog?.[0] || {};
    const analysisList = vcon.analysis || [];
    const body = this.getSummaryText(vcon);

    let sentiment = 0;
    const negativeWords = ['bad', 'terrible', 'angry', 'frustrated', 'broken', 'problem', 'issue', 'complaint', 'sad'];
    const positiveWords = ['good', 'great', 'happy', 'thanks', 'excellent', 'love', 'appreciate', 'help'];

    const text = body.toLowerCase();
    negativeWords.forEach(w => { if (text.includes(w)) sentiment -= 0.3; });
    positiveWords.forEach(w => { if (text.includes(w)) sentiment += 0.3; });
    sentiment = Math.max(-1, Math.min(1, sentiment));

    const entities = [];
    if (text.includes('order')) entities.push('order_issue');
    if (text.includes('return') || text.includes('refund')) entities.push('return');
    if (text.includes('appointment') || text.includes('schedule')) entities.push('appointment');
    if (text.includes('price') || text.includes('cost')) entities.push('pricing');
    if (text.includes('shipping') || text.includes('delivery')) entities.push('shipping');

    const hasSentiment = analysisList.some(a => a.type === 'sentiment');
    const hasEntities = analysisList.some(a => a.type === 'entities');

    const enriched = { ...vcon, analysis: [...analysisList] };

    if (!hasSentiment) {
      enriched.analysis.push({
        type: 'sentiment',
        body: sentiment.toString(),
        vendor: 'simulated'
      });
    }

    if (!hasEntities && entities.length > 0) {
      enriched.analysis.push({
        type: 'entities',
        body: JSON.stringify(entities),
        vendor: 'simulated'
      });
    }

    return enriched;
  }

  getSummaryText(vcon) {
    const summary = vcon.analysis?.find(a => a.type === 'summary');
    if (summary?.body) return String(summary.body);

    const transcript = vcon.analysis?.find(a => a.type === 'transcript');
    if (transcript?.body?.transcript) return transcript.body.transcript;
    if (transcript?.body) return String(transcript.body);

    const diarized = vcon.analysis?.find(a => a.type === 'diarized');
    if (diarized?.body) return String(diarized.body);

    return '';
  }
}

module.exports = new ConserverService();
