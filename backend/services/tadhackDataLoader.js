const axios = require('axios');
const conserver = require('./conserver');

const GITHUB_BASE = 'https://raw.githubusercontent.com/vcon-dev/tadhack-2025/main';
const GITHUB_API = 'https://api.github.com/repos/vcon-dev/tadhack-2025/contents';

/**
 * TADHack 2025 Data Loader
 * - Fetches vCon file list from GitHub API
 * - Downloads 42 vCons from numbered directories (18-24)
 * - Submits to Conserver for processing (or uses local fallback)
 * - Converts to UnifiedCase format with tadhackMeta
 */
class TADHackDataLoader {
  constructor() {
    this.baseUrl = GITHUB_BASE;
  }

  /**
   * Get list of all vCon JSON files from tadhack-2025 repo
   * Repo structure: 18/, 19/, 20/, 21/, 22/, 23/, 24/ each with {uuid}.vcon.json
   */
  async getVconFileList() {
    const dayDirs = ['18', '19', '20', '21', '22', '23', '24'];
    const files = [];

    for (const day of dayDirs) {
      try {
        const { data } = await axios.get(`${GITHUB_API}/${day}`, {
          headers: { Accept: 'application/vnd.github.v3+json' },
          timeout: 10000
        });

        const items = Array.isArray(data) ? data : [];
        const vconFiles = items.filter(item => item.type !== 'dir');
        for (const f of vconFiles) {
          if (f.name && f.name.endsWith('.vcon.json')) {
            files.push({
              path: `${day}/${f.name}`,
              dayDir: day,
              filename: f.name,
              mp3Filename: f.name.replace('.vcon.json', '.mp3')
            });
          }
        }
      } catch (err) {
        console.warn(`Could not list dir ${day}:`, err.message);
      }
    }

    return files;
  }

  /**
   * Download a single vCon from GitHub
   */
  async downloadVcon(filePath) {
    const url = `${this.baseUrl}/${filePath}`;
    const { data } = await axios.get(url, { timeout: 15000 });
    return data;
  }

  /**
   * Submit vCon to Conserver for processing (transcription, sentiment, entities)
   * Falls back to local processing if Conserver unavailable
   */
  async processWithConserver(vcon) {
    try {
      const processed = await conserver.ingestAndProcess(vcon);
      return processed || vcon;
    } catch (err) {
      console.warn('Conserver unavailable, using local fallback:', err.message);
      return conserver.simulateProcessing(vcon);
    }
  }

  /**
   * Convert vCon to UnifiedCase format with tadhackMeta
   */
  convertVconToCase(vcon, fileInfo) {
    const dialog = vcon.dialog?.[0] || {};
    const analysisList = vcon.analysis || [];
    const parties = vcon.parties || [];

    const transcriptAnalysis = analysisList.find(a => a.type === 'transcript');
    const summaryAnalysis = analysisList.find(a => a.type === 'summary');
    const diarizedAnalysis = analysisList.find(a => a.type === 'diarized');

    const summary = summaryAnalysis?.body || (typeof transcriptAnalysis?.body === 'object'
      ? transcriptAnalysis.body?.transcript?.substring(0, 200) : 'No summary');
    const confidence = transcriptAnalysis?.body?.confidence ?? 0.99;
    const disposition = dialog.meta?.disposition || dialog.meta?.agent_selected_disposition || 'ANSWERED';

    const customer = parties.find(p => p.role === 'customer') || parties[0] || {};
    const agent = parties.find(p => p.role === 'agent') || parties[1] || {};

    const sentimentScore = this.extractSentiment(vcon, analysisList);
    const transcriptSnippet = this.buildTranscriptSnippet(diarizedAnalysis, transcriptAnalysis);

    const touchpoint = {
      vconUuid: vcon.uuid,
      channel: dialog.type === 'recording' ? 'voice' : 'voice',
      timestamp: vcon.created_at || new Date().toISOString(),
      participants: parties.map(p => ({
        name: p.name || 'Unknown',
        role: p.role || 'unknown',
        tel: p.tel,
        mailto: p.mailto
      })),
      summary: typeof summary === 'string' ? summary : JSON.stringify(summary),
      sentimentScore,
      keyEntities: this.extractEntities(vcon, analysisList),
      recordingUrl: null,
      transcriptSnippet,
      duration: dialog.duration || 0
    };

    const caseId = `tadhack_${vcon.uuid}`;
    const customerId = `cust_tadhack_${(customer.tel || customer.mailto || vcon.uuid).toString().replace(/\D/g, '')}`;

    return {
      caseId,
      customerId,
      customer: {
        customerId,
        names: [customer.name || 'Unknown Customer'],
        phones: customer.tel ? [customer.tel] : [],
        emails: customer.mailto ? [customer.mailto] : [],
        createdAt: new Date().toISOString()
      },
      status: 'open',
      priority: this.calculatePriority(vcon, analysisList),
      createdAt: vcon.created_at,
      updatedAt: vcon.created_at,
      assignedAgent: agent.name || null,
      touchpoints: [touchpoint],
      tags: ['tadhack_2025', 'yacht_broker', 'synthetic_data'],
      sentimentJourney: [{
        time: vcon.created_at,
        sentiment: sentimentScore,
        channel: touchpoint.channel
      }],
      collisionAlert: false,
      source: 'tadhack_2025_dataset',
      tadhackMeta: {
        filename: fileInfo.mp3Filename,
        filePath: `${fileInfo.dayDir}/${fileInfo.mp3Filename}`,
        dayDir: fileInfo.dayDir,
        transcriptionConfidence: `${Math.round(confidence * 100)}%`,
        callDisposition: disposition
      }
    };
  }

  extractSentiment(vcon, analysisList) {
    const summaryAnalysis = analysisList.find(a => a.type === 'summary');
    const body = summaryAnalysis?.body || '';
    const text = (typeof body === 'string' ? body : JSON.stringify(body)).toLowerCase();

    const negativeWords = ['angry', 'frustrated', 'problem', 'issue', 'complaint', 'wrong', 'bad', 'terrible', 'sad'];
    const positiveWords = ['happy', 'satisfied', 'great', 'excellent', 'good', 'thanks', 'appreciate', 'help'];

    let score = 0;
    negativeWords.forEach(w => { if (text.includes(w)) score -= 0.3; });
    positiveWords.forEach(w => { if (text.includes(w)) score += 0.3; });

    return Math.max(-1, Math.min(1, score));
  }

  extractEntities(vcon, analysisList) {
    const entities = [];
    const summaryAnalysis = analysisList.find(a => a.type === 'summary');
    const body = summaryAnalysis?.body || '';
    const text = (typeof body === 'string' ? body : JSON.stringify(body)).toLowerCase();

    if (text.includes('return') || text.includes('refund')) entities.push('return');
    if (text.includes('order')) entities.push('order');
    if (text.includes('shipping') || text.includes('delivery')) entities.push('shipping');
    if (text.includes('appointment') || text.includes('schedule')) entities.push('appointment');
    if (text.includes('price') || text.includes('cost')) entities.push('pricing');

    return entities;
  }

  calculatePriority(vcon, analysisList) {
    const summaryAnalysis = analysisList.find(a => a.type === 'summary');
    const body = summaryAnalysis?.body || '';
    const text = (typeof body === 'string' ? body : JSON.stringify(body)).toLowerCase();

    if (text.includes('urgent') || text.includes('emergency') || text.includes('angry')) return 5;
    if (text.includes('complaint') || text.includes('frustrated')) return 4;
    if (text.includes('issue') || text.includes('problem')) return 3;
    return 2;
  }

  buildTranscriptSnippet(diarizedAnalysis, transcriptAnalysis) {
    if (diarizedAnalysis?.body) {
      const lines = String(diarizedAnalysis.body).split('\n').filter(l => l.trim()).slice(0, 2);
      return lines.join(' | ') || 'No transcript';
    }
    if (transcriptAnalysis?.body?.transcript) {
      return String(transcriptAnalysis.body.transcript).substring(0, 150) + '...';
    }
    return 'No transcript available';
  }

  /**
   * Full pipeline: fetch file list -> download -> process -> convert
   */
  async loadAllCases(onProgress) {
    const files = await this.getVconFileList();
    if (files.length === 0) {
      throw new Error('No vCon files found in tadhack-2025 repository');
    }

    const cases = [];
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const fileInfo = files[i];
      try {
        if (onProgress) onProgress({ current: i + 1, total, phase: 'download', file: fileInfo.filename });

        const vcon = await this.downloadVcon(fileInfo.path);

        if (onProgress) onProgress({ current: i + 1, total, phase: 'process', file: fileInfo.filename });

        const processed = await this.processWithConserver(vcon);
        const caseData = this.convertVconToCase(processed, fileInfo);
        cases.push(caseData);
      } catch (err) {
        console.error(`Failed to load ${fileInfo.path}:`, err.message);
      }
    }

    return cases;
  }
}

module.exports = new TADHackDataLoader();
