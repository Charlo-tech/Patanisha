// Simple in-memory database
class Database {
    constructor() {
      this.cases = new Map();
      this.customers = new Map();
      this.resolver = new Map(); // phone/email -> customerId
    }
  
    // Customer methods
    findOrCreateCustomer(identity) {
      const { phone, email, name } = identity;
      
      // Try to find existing customer
      let customerId = null;
      
      if (phone) {
        const normalizedPhone = this.normalizePhone(phone);
        customerId = this.resolver.get(`phone:${normalizedPhone}`);
      }
      
      if (!customerId && email) {
        const normalizedEmail = email.toLowerCase().trim();
        customerId = this.resolver.get(`email:${normalizedEmail}`);
      }
  
      // Create new customer if not found
      if (!customerId) {
        customerId = `cust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const customer = {
          customerId,
          phones: phone ? [phone] : [],
          emails: email ? [email] : [],
          names: name ? [name] : [],
          createdAt: new Date().toISOString()
        };
        
        this.customers.set(customerId, customer);
        
        // Index for future lookups
        if (phone) {
          this.resolver.set(`phone:${this.normalizePhone(phone)}`, customerId);
        }
        if (email) {
          this.resolver.set(`email:${email.toLowerCase().trim()}`, customerId);
        }
      } else {
        // Update existing customer with new info
        const customer = this.customers.get(customerId);
        if (phone && !customer.phones.includes(phone)) {
          customer.phones.push(phone);
          this.resolver.set(`phone:${this.normalizePhone(phone)}`, customerId);
        }
        if (email && !customer.emails.includes(email)) {
          customer.emails.push(email);
          this.resolver.set(`email:${email.toLowerCase().trim()}`, customerId);
        }
        if (name && !customer.names.includes(name)) {
          customer.names.push(name);
        }
      }
  
      return this.customers.get(customerId);
    }
  
    normalizePhone(phone) {
      const digits = phone.replace(/\D/g, '');
      return digits.length === 10 ? `+1${digits}` : `+${digits}`;
    }
  
    // Case methods
    findActiveCaseForCustomer(customerId) {
      const CASE_WINDOW_HOURS = 24;
      
      for (const [caseId, caseData] of this.cases) {
        if (caseData.customerId !== customerId) continue;
        if (caseData.status === 'resolved') continue;
        
        const lastUpdate = new Date(caseData.updatedAt);
        const hoursSince = (Date.now() - lastUpdate) / (1000 * 60 * 60);
        
        if (hoursSince < CASE_WINDOW_HOURS) {
          return caseData;
        }
      }
      
      return null;
    }
  
    createCase(customerId, touchpoint) {
      const caseId = `case_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
      const newCase = {
        caseId,
        customerId,
        status: 'open',
        priority: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assignedAgent: null,
        touchpoints: [touchpoint],
        tags: [],
        collisionAlert: false,
        sentimentJourney: []
      };
  
      this.cases.set(caseId, newCase);
      return newCase;
    }
  
    addTouchpoint(caseId, touchpoint) {
      const caseData = this.cases.get(caseId);
      if (!caseData) return null;
      
      caseData.touchpoints.push(touchpoint);
      caseData.touchpoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      caseData.updatedAt = new Date().toISOString();
      
      this.recalculatePriority(caseData);
      this.checkCollision(caseData);
      this.buildSentimentJourney(caseData);
      
      return caseData;
    }
  
    recalculatePriority(caseData) {
      let score = 3;
      
      // Sentiment factor
      const sentiments = caseData.touchpoints.map(t => t.sentimentScore || 0);
      const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
      
      if (avgSentiment < -0.5) score += 2;
      else if (avgSentiment < 0) score += 1;
      
      // Keywords
      const urgentKeywords = ['urgent', 'asap', 'emergency', 'angry', 'frustrated', 'manager', 'complaint'];
      const hasUrgent = caseData.touchpoints.some(tp => 
        urgentKeywords.some(kw => (tp.transcriptSnippet || '').toLowerCase().includes(kw))
      );
      if (hasUrgent) score += 1;
      
      // Channel factor
      const hasVoice = caseData.touchpoints.some(tp => tp.channel === 'voice');
      if (hasVoice) score += 0.5;
      
      caseData.priority = Math.min(5, Math.max(1, Math.floor(score)));
    }
  
    checkCollision(caseData) {
      if (caseData.touchpoints.length < 2) return;
      
      const last = caseData.touchpoints[caseData.touchpoints.length - 1];
      const prev = caseData.touchpoints[caseData.touchpoints.length - 2];
      
      const timeDiff = (new Date(last.timestamp) - new Date(prev.timestamp)) / (1000 * 60); // minutes
      
      if (timeDiff < 5) {
        const lastAgents = new Set(last.participants.map(p => p.name));
        const prevAgents = new Set(prev.participants.map(p => p.name));
        
        // Simple check: if different number of participants or different names
        if (lastAgents.size !== prevAgents.size || 
            ![...lastAgents].every(a => prevAgents.has(a))) {
          caseData.collisionAlert = true;
          caseData.tags.push('agent_collision');
        }
      }
    }
  
    buildSentimentJourney(caseData) {
      caseData.sentimentJourney = caseData.touchpoints.map(tp => ({
        time: tp.timestamp,
        sentiment: tp.sentimentScore || 0,
        channel: tp.channel
      }));
    }
  
    getAllCases(filters = {}) {
      let cases = Array.from(this.cases.values());
      
      if (filters.status) {
        cases = cases.filter(c => c.status === filters.status);
      }
      if (filters.priority) {
        cases = cases.filter(c => c.priority >= parseInt(filters.priority));
      }
      
      // Sort by updated desc
      return cases.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
  
    getCase(caseId) {
      const caseData = this.cases.get(caseId);
      if (!caseData) return null;
      
      // Enrich with customer data
      const customer = this.customers.get(caseData.customerId);
      return { ...caseData, customer };
    }
  
    updateCase(caseId, updates) {
      const caseData = this.cases.get(caseId);
      if (!caseData) return null;
      
      Object.assign(caseData, updates, { updatedAt: new Date().toISOString() });
      return caseData;
    }

    /**
     * Add a TADHack case (full case with embedded customer)
     */
    addTadhackCase(caseData) {
      const { customer, customerId } = caseData;
      if (customer) {
        this.customers.set(customerId, customer);
        if (customer.phones?.[0]) {
          this.resolver.set(`phone:${this.normalizePhone(customer.phones[0])}`, customerId);
        }
        if (customer.emails?.[0]) {
          this.resolver.set(`email:${customer.emails[0].toLowerCase().trim()}`, customerId);
        }
      }
      if (caseData.touchpoints?.length) {
        this.recalculatePriority(caseData);
        this.buildSentimentJourney(caseData);
      }
      this.cases.set(caseData.caseId, caseData);
      return caseData;
    }
  }
  
  // Singleton instance
  const db = new Database();
  module.exports = db;