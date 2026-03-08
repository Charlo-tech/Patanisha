// Configuration - use backend URL (port 8001); use same origin only when dashboard is served from backend
const API_PORT = 8002;
const API_URL = (typeof window !== 'undefined' && window.location.port === String(API_PORT))
    ? window.location.origin
    : `http://localhost:${API_PORT}`;
let selectedCaseId = null;
let refreshInterval = null;
let tadhackLoading = false;
let casesCache = {};
let currentFilter = { source: 'all' };

function refreshIcons() {
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadCases();
    setupAutoRefresh();
    setupFilters();
});

// Setup auto-refresh
function setupAutoRefresh() {
    const checkbox = document.getElementById('autoRefresh');
    checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    });
    startAutoRefresh();
}

function startAutoRefresh() {
    refreshInterval = setInterval(loadCases, 5000);
}

function stopAutoRefresh() {
    clearInterval(refreshInterval);
}

// Setup filters
function setupFilters() {
    document.getElementById('statusFilter').addEventListener('change', loadCases);
    document.getElementById('priorityFilter').addEventListener('change', loadCases);
}

// ─── SIMULATE AFRICA'S TALKING ─────────────────────────────────────────────

async function simulateAfricasTalking() {
    const btn = document.getElementById('simulateBtn');
    if (btn.disabled) return;
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Simulating...';
    refreshIcons();
    
    try {
        const url = `${API_URL}/api/simulate/batch`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count: 10 })
        });
        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch {
            throw new Error(`Server returned HTML. Ensure backend is running (cd backend && node server.js) and open http://localhost:${API_PORT}/`);
        }
        if (!response.ok) throw new Error(result.error || 'Simulation failed');
        
        await loadCases();
        showFilterTabs();
        refreshIcons();
        statusToast(`Simulated ${result.total} cases (each with voice, SMS thread, and emails)`);
    } catch (error) {
        console.error('Simulate error:', error);
        statusToast('Simulation failed: ' + error.message, true);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="phone-call"></i> Simulate Calls & SMS';
        refreshIcons();
    }
}

function statusToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:20px;right:20px;padding:12px 20px;border-radius:8px;color:white;font-size:0.9rem;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.3);`;
    toast.style.background = isError ? 'var(--danger)' : 'var(--success)';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ─── TADHACK DATA LOADING ─────────────────────────────────────────────────

async function loadTadhackData() {
    if (tadhackLoading) return;
    
    tadhackLoading = true;
    const btn = document.getElementById('loadTadhackBtn');
    const status = document.getElementById('tadhackStatus');
    
    // Update button state
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Loading...';
    
    // Show modal
    showTadhackModal();
    updateProgress(10);
    
    const startTime = Date.now();
    
    try {
        updateProgress(30);
        document.getElementById('tadhackLoadingText').textContent = 'Connecting to TADHack repository...';
        
        // Call backend API
        const response = await fetch(`${API_URL}/api/tadhack/load`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        updateProgress(60);
        document.getElementById('tadhackLoadingText').textContent = 'Processing conversations...';
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        updateProgress(90);
        document.getElementById('tadhackLoadingText').textContent = 'Updating dashboard...';
        
        // Refresh case list
        await loadCases();
        
        updateProgress(100);
        
        // Show success
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        document.getElementById('tadhackCount').textContent = result.loaded;
        document.getElementById('tadhackDuration').textContent = `${duration}s`;
        document.getElementById('tadhackStats').style.display = 'grid';
        document.getElementById('tadhackLoadingText').innerHTML = 
            `<strong>Successfully loaded ${result.loaded} cases from TADHack 2025!</strong><br>
             <small>Aquidneck Yacht Brokers customer service conversations</small>`;
        
        // Enable close button
        document.getElementById('tadhackCloseBtn').style.display = 'inline-block';
        
        // Update status badge
        status.innerHTML = `<i data-lucide="check-circle" style="width:14px;height:14px"></i> ${result.loaded} cases`;
        status.className = 'status-badge';
        
        // Show filter tabs
        showFilterTabs();
        refreshIcons();
        
    } catch (error) {
        console.error('Failed to load TADHack data:', error);
        
        document.getElementById('tadhackLoadingText').innerHTML = 
            `<strong>Error loading data</strong><br>
             <small>${error.message}</small>`;
        document.getElementById('tadhackLoadingText').style.color = '#dc3545';
        
        status.innerHTML = '<i data-lucide="x-circle" style="width:14px;height:14px"></i> Failed';
        status.className = 'status-badge error';
        
        document.getElementById('tadhackCloseBtn').style.display = 'inline-block';
        
    } finally {
        tadhackLoading = false;
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.innerHTML = '<i data-lucide="database"></i> Load TADHack Data';
        refreshIcons();
    }
}

function showTadhackModal() {
    document.getElementById('tadhackModal').classList.add('active');
    document.getElementById('tadhackProgress').style.width = '0%';
    document.getElementById('tadhackStats').style.display = 'none';
    document.getElementById('tadhackCloseBtn').style.display = 'none';
    document.getElementById('tadhackLoadingText').textContent = 'Initializing...';
    document.getElementById('tadhackLoadingText').style.color = '';
}

function closeTadhackModal() {
    document.getElementById('tadhackModal').classList.remove('active');
}

function updateProgress(percent) {
    document.getElementById('tadhackProgress').style.width = `${percent}%`;
}

function showFilterTabs() {
    const tabs = document.getElementById('filterTabs');
    tabs.style.display = 'flex';
}

function filterBySource(source) {
    // Update active tab
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.closest('.filter-tab').classList.add('active');
    
    // Apply filter
    currentFilter = { source };
    loadCases();
}

// ─── CASE LOADING ─────────────────────────────────────────────────────────

async function loadCases() {
    try {
        const status = document.getElementById('statusFilter')?.value || '';
        const priority = document.getElementById('priorityFilter')?.value || '';
        const source = currentFilter?.source || 'all';
        
        let url = `${API_URL}/api/cases`;
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (priority) params.append('priority', priority);
        
        if (params.toString()) url += '?' + params.toString();
        
        const response = await fetch(url);
        let cases = await response.json();
        
        // Client-side source filtering
        if (source === 'tadhack') {
            cases = cases.filter(c => c.source === 'tadhack_2025_dataset');
        } else if (source === 'africastalking') {
            cases = cases.filter(c => c.source !== 'tadhack_2025_dataset');
        }
        
        // Cache for counts
        casesCache = cases.reduce((acc, c) => {
            acc[c.caseId] = c;
            return acc;
        }, {});
        
        renderCaseList(cases);
        updateFilterCounts();
        
    } catch (error) {
        console.error('Failed to load cases:', error);
        document.getElementById('caseList').innerHTML = `
            <div style="padding: 2rem; text-align: center; color: var(--danger);">
                <p>Error loading cases</p>
                <button onclick="loadCases()" style="margin-top: 12px;"><i data-lucide="refresh-cw"></i> Retry</button>
            </div>
        `;
        refreshIcons();
    }
}

function updateFilterCounts() {
    const allCases = Object.values(casesCache);
    const allEl = document.getElementById('count-all');
    const atEl = document.getElementById('count-at');
    const tadhackEl = document.getElementById('count-tadhack');
    
    if (allEl) allEl.textContent = allCases.length;
    if (atEl) atEl.textContent = allCases.filter(c => c.source !== 'tadhack_2025_dataset').length;
    if (tadhackEl) tadhackEl.textContent = allCases.filter(c => c.source === 'tadhack_2025_dataset').length;
}

function renderCaseList(cases) {
    const container = document.getElementById('caseList');
    
    if (cases.length === 0) {
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
                <p>No cases found</p>
                ${!document.getElementById('filterTabs')?.style.display ? `
                    <button onclick="loadTadhackData()" class="btn-tadhack" style="margin-top: 12px;">
                        <i data-lucide="database"></i> Load Sample Data
                    </button>
                ` : ''}
            </div>
        `;
        refreshIcons();
        return;
    }
    
    container.innerHTML = cases.map(c => {
        const isTadhack = c.source === 'tadhack_2025_dataset';
        
        return `
        <div class="case-card priority-${c.priority} ${c.caseId === selectedCaseId ? 'active' : ''}" 
             onclick="selectCase('${c.caseId}')">
            <div class="case-header">
                <span class="case-title">
                    <i data-lucide="${isTadhack ? 'award' : 'phone'}" style="width:16px;height:16px"></i>
                    ${c.customer?.names?.[0] || 'Unknown'}
                </span>
                <span class="priority-badge">P${c.priority}</span>
            </div>
            
            ${isTadhack ? `
                <div class="data-source-indicator data-source-tadhack">
                    <i data-lucide="award" style="width:14px;height:14px"></i>
                    TADHack 2025 • Aquidneck Yacht Brokers
                </div>
            ` : ''}
            
            <div class="case-meta">
                <i data-lucide="smartphone" style="width:14px;height:14px"></i>
                ${c.customer?.phones?.[0] || 'No phone'} • ${formatTimeAgo(c.updatedAt)}
                ${c.touchpoints?.length > 1 ? `• ${c.touchpoints.length} touchpoints` : ''}
            </div>
            
            <div class="case-preview">
                ${c.touchpoints?.[c.touchpoints.length - 1]?.summary || 'No activity'}
            </div>
            
            ${c.collisionAlert ? '<div class="collision-alert"><i data-lucide="alert-triangle" style="width:14px;height:14px"></i> Agent Collision</div>' : ''}
        </div>
    `}).join('');
    refreshIcons();
}

// ─── CASE DETAIL ───────────────────────────────────────────────────────────

async function selectCase(caseId) {
    selectedCaseId = caseId;
    
    // Update UI selection
    document.querySelectorAll('.case-card').forEach(el => el.classList.remove('active'));
    const selectedCard = document.querySelector(`[onclick="selectCase('${caseId}')"]`);
    if (selectedCard) selectedCard.classList.add('active');
    
    try {
        const response = await fetch(`${API_URL}/api/cases/${caseId}`);
        const caseData = await response.json();
        
        renderCaseDetail(caseData);
    } catch (error) {
        console.error('Failed to load case:', error);
    }
}

function renderTouchpointsByChannel(touchpoints) {
    if (!touchpoints?.length) return '<div class="timeline"><h3><i data-lucide="clock"></i> Conversation Timeline</h3><p>No touchpoints yet</p></div>';
    const voice = touchpoints.filter(t => t.channel === 'voice');
    const sms = touchpoints.filter(t => t.channel === 'sms');
    const email = touchpoints.filter(t => t.channel === 'email');

    function renderItem(tp, label, icon) {
        return `
            <div class="timeline-item">
                <div class="timeline-icon ${tp.channel}">
                    <i data-lucide="${icon}" style="width:20px;height:20px"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <strong>${label}</strong>
                        <span class="timeline-time">${formatTime(tp.timestamp)}</span>
                    </div>
                    <div class="timeline-body">
                        <p><strong>Summary:</strong> ${tp.summary || '-'}</p>
                        ${tp.transcriptSnippet ? `
                            <p style="margin-top: 0.5rem; color: #586069; font-style: italic;">
                                "${tp.transcriptSnippet}"
                            </p>
                        ` : ''}
                    </div>
                    <span class="sentiment-badge ${getSentimentClass(tp.sentimentScore)}">
                        Sentiment: ${(tp.sentimentScore ?? 0).toFixed(2)}
                    </span>
                </div>
            </div>
        `;
    }

    let html = '<div class="timeline"><h3><i data-lucide="clock"></i> Conversation Timeline</h3>';
    if (voice.length) {
        html += `<h4 class="timeline-section"><i data-lucide="phone" style="width:16px;height:16px"></i> Voice Calls</h4>`;
        html += voice.map(tp => renderItem(tp, 'Voice Call', 'phone')).reverse().join('');
    }
    if (sms.length) {
        html += `<h4 class="timeline-section"><i data-lucide="message-square" style="width:16px;height:16px"></i> SMS Thread</h4>`;
        html += sms.map(tp => renderItem(tp, 'SMS', 'message-square')).reverse().join('');
    }
    if (email.length) {
        html += `<h4 class="timeline-section"><i data-lucide="mail" style="width:16px;height:16px"></i> Emails</h4>`;
        html += email.map(tp => renderItem(tp, 'Email', 'mail')).reverse().join('');
    }
    html += '</div>';
    return html;
}

function renderCaseDetail(caseData) {
    const container = document.getElementById('mainContent');
    const customer = caseData.customer;
    const isTadhack = caseData.source === 'tadhack_2025_dataset';
    const latestTouch = caseData.touchpoints?.[caseData.touchpoints.length - 1];
    
    container.innerHTML = `
        <div class="case-detail">
            ${isTadhack ? renderTadhackBanner(caseData) : ''}
            
            <div class="data-source-indicator ${isTadhack ? 'data-source-tadhack' : 'data-source-africastalking'}">
                <i data-lucide="${isTadhack ? 'award' : 'phone'}" style="width:14px;height:14px"></i>
                ${isTadhack ? 'TADHack 2025 Dataset' : 'Africa\'s Talking Live'}
            </div>
            
            <h2>${customer?.names?.[0] || 'Unknown Customer'}</h2>
            
            <div class="metrics">
                <div class="metric-card">
                    <div class="metric-value">${caseData.touchpoints?.length || 0}</div>
                    <div class="metric-label">Touchpoints</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${caseData.priority}</div>
                    <div class="metric-label">Priority</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color: ${getSentimentColor(caseData.sentimentJourney)}">●</div>
                    <div class="metric-label">Sentiment</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="font-size: 0.9rem;">${caseData.status}</div>
                    <div class="metric-label">Status</div>
                </div>
            </div>
            
            <div class="customer-info">
                <h3>Customer Information</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Phone</span>
                        <div>${customer?.phones?.[0] || 'N/A'}</div>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Email</span>
                        <div>${customer?.emails?.[0] || 'N/A'}</div>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Case ID</span>
                        <div>${caseData.caseId}</div>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Assigned</span>
                        <div>${caseData.assignedAgent || 'Unassigned'}</div>
                    </div>
                </div>
            </div>
            
            <div class="actions">
                ${caseData.status === 'open' ? 
                    `<button class="btn-primary" onclick="claimCase('${caseData.caseId}')"><i data-lucide="user-plus"></i> Claim Case</button>` : ''}
                <button class="btn-warning" onclick="openSMSModal('${caseData.caseId}')"><i data-lucide="message-square"></i> Send SMS</button>
                <button class="btn-success" onclick="resolveCase('${caseData.caseId}')"><i data-lucide="check-circle"></i> Resolve</button>
            </div>
            
            ${caseData.collisionAlert ? `
                <div class="collision-alert-banner">
                    <i data-lucide="alert-triangle" style="width:20px;height:20px;flex-shrink:0"></i>
                    <span><strong>Agent Collision Detected:</strong> Another agent may be working this case.</span>
                </div>
            ` : ''}
            
            ${isTadhack ? renderTadhackAudioPlayer(caseData) : renderStandardAudio(caseData)}
            
            ${renderTouchpointsByChannel(caseData.touchpoints)}
        </div>
    `;
    refreshIcons();
}

function renderTadhackBanner(caseData) {
    const meta = caseData.tadhackMeta || {};
    const date = new Date(caseData.createdAt).toLocaleDateString();
    
    return `
        <div class="tadhack-banner">
            <h4><i data-lucide="award" style="width:18px;height:18px"></i> TADHack 2025 Synthetic Dataset</h4>
            <p>Aquidneck Yacht Brokers • ${date} • ${meta.callDisposition || 'ANSWERED'}</p>
            ${meta.transcriptionConfidence ? `
                <small><i data-lucide="target" style="width:12px;height:12px;display:inline;vertical-align:middle"></i> Transcription Confidence: ${meta.transcriptionConfidence}</small>
            ` : ''}
        </div>
    `;
}

function renderTadhackAudioPlayer(caseData) {
    const meta = caseData.tadhackMeta || {};
    const audioPath = meta.filePath || meta.filename?.replace('.json', '.mp3') || `${caseData.caseId}.mp3`;
    const mp3Filename = audioPath.includes('/') ? audioPath.split('/').pop() : audioPath;
    const audioUrl = `${API_URL}/audio/tadhack-audio/${audioPath}`;
    const duration = formatDuration(caseData.touchpoints[0]?.duration);
    
    return `
        <div class="audio-player">
            <h4><i data-lucide="music" style="width:18px;height:18px"></i> Original Recording from TADHack Dataset</h4>
            <audio controls style="width: 100%;" preload="metadata">
                <source src="${audioUrl}" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
            <div class="audio-meta">
                <span><i data-lucide="timer" style="width:14px;height:14px"></i> Duration: ${duration}</span>
                <span><i data-lucide="target" style="width:14px;height:14px"></i> Confidence: ${meta.transcriptionConfidence || '99%'}</span>
                <span><i data-lucide="file-audio" style="width:14px;height:14px"></i> ${mp3Filename}</span>
            </div>
            <p style="margin-top: 12px; font-size: 0.85rem; color: #6c757d;">
                <small>This is synthetic data from the TADHack 2025 repository for demonstration purposes.</small>
            </p>
        </div>
    `;
}

function renderStandardAudio(caseData) {
    const touchpoint = caseData.touchpoints?.find(tp => tp.recordingUrl);
    if (!touchpoint?.recordingUrl) return '';
    
    return `
        <div class="audio-player">
            <h4><i data-lucide="music" style="width:18px;height:18px"></i> Call Recording</h4>
            <audio controls style="width: 100%;">
                <source src="${touchpoint.recordingUrl}" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
            <div class="audio-meta">
                <span><i data-lucide="timer" style="width:14px;height:14px"></i> Duration: ${formatDuration(touchpoint.duration)}</span>
            </div>
        </div>
    `;
}

// ─── ACTIONS ─────────────────────────────────────────────────────────────

async function claimCase(caseId) {
    const agentId = prompt('Enter your Agent ID:', 'agent_001');
    if (!agentId) return;
    
    try {
        const response = await fetch(`${API_URL}/api/cases/${caseId}/claim?agentId=${agentId}`, {
            method: 'POST'
        });
        if (response.ok) {
            alert('Case claimed!');
            loadCases();
            selectCase(caseId);
        }
    } catch (error) {
        alert('Failed to claim case');
    }
}

function openSMSModal(caseId) {
    selectedCaseId = caseId;
    document.getElementById('smsModal').classList.add('active');
    document.getElementById('smsMessage').value = '';
}

function closeModal() {
    document.getElementById('smsModal').classList.remove('active');
}

async function sendSMS() {
    const message = document.getElementById('smsMessage').value;
    if (!message.trim()) return;
    
    try {
        const response = await fetch(
            `${API_URL}/api/cases/${selectedCaseId}/reply?message=${encodeURIComponent(message)}`,
            { method: 'POST' }
        );
        
        if (response.ok) {
            closeModal();
            alert('SMS sent!');
            loadCases();
        } else {
            alert('Failed to send SMS');
        }
    } catch (error) {
        alert('Error sending SMS');
    }
}

async function resolveCase(caseId) {
    const resolution = prompt('Enter resolution notes:');
    if (resolution === null) return;
    
    try {
        const response = await fetch(
            `${API_URL}/api/cases/${caseId}/resolve?resolution=${encodeURIComponent(resolution)}`,
            { method: 'POST' }
        );
        
        if (response.ok) {
            alert('Case resolved!');
            loadCases();
        }
    } catch (error) {
        alert('Failed to resolve case');
    }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────

function formatTimeAgo(isoString) {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    const now = new Date();
    const diff = (now - date) / 1000;
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
}

function formatTime(isoString) {
    if (!isoString) return 'Unknown';
    return new Date(isoString).toLocaleString();
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getSentimentClass(score) {
    if (score > 0.3) return 'sentiment-positive';
    if (score < -0.3) return 'sentiment-negative';
    return 'sentiment-neutral';
}

function getSentimentColor(journey) {
    if (!journey?.length) return '#999';
    const latest = journey[journey.length - 1].sentiment;
    if (latest > 0.3) return '#28a745';
    if (latest < -0.3) return '#dc3545';
    return '#ffc107';
}