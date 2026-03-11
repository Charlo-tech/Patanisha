# UnifiedCase (Patanisha)

A vCon-powered customer support unification platform that consolidates voice calls, SMS, and emails from Africa's Talking into a single dashboard. Built for TADHack 2025/2026 with support for the TADHack synthetic dataset and live Africa's Talking integrations.

---

## Features

- **Unified case management** — Single view for all customer touchpoints (voice, SMS, email)
- **Africa's Talking integration** — Live webhooks for incoming calls and SMS
- **TADHack 2025 dataset** — Load synthetic yacht broker conversations for demos
- **Simulation mode** — Generate sample cases without real Africa's Talking setup
- **Sentiment tracking** — Per-touchpoint sentiment scores and journey visualization
- **Agent collision detection** — Alerts when multiple agents may be working the same case
- **Audio playback** — Stream call recordings from TADHack dataset or Africa's Talking
- **Case actions** — Claim, reply via SMS, resolve with notes

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JS, HTML, CSS (Lucide icons) |
| Backend | Node.js, Express |
| Data | In-memory store (demo); optional Conserver for vCon processing |
| Integrations | Africa's Talking (voice, SMS), Conserver (vCon MCP) |
| Deployment | Netlify (static + serverless), Docker (local infra) |

---

## Project Structure

```
Patanisha/
├── backend/                 # Express API
│   ├── server.js            # Main app (exports for Netlify)
│   ├── models/Case.js       # In-memory case database
│   ├── routes/              # API routes
│   │   ├── cases.js         # Case CRUD, claim, resolve, reply
│   │   ├── webhook.js       # Africa's Talking webhooks
│   │   ├── simulate.js      # Simulation endpoints
│   │   └── audio.js         # TADHack audio streaming
│   ├── services/
│   │   ├── africastalking.js # AT voice/SMS client
│   │   ├── conserver.js     # vCon processing (optional)
│   │   ├── tadhackDataLoader.js
│   │   ├── simulator.js     # Sample data generator
│   │   └── unification.js  # vCon → case conversion
│   └── test/
├── dashboard/               # Static frontend
│   ├── index.html
│   └── app.js
├── config/chains.yml        # Processing pipeline config
├── netlify/                 # Netlify serverless function
│   └── functions/server.js
├── docker-compose.yml       # Redis, Postgres, Conserver (optional)
├── netlify.toml             # Netlify build & redirects
└── package.json
```

---

## Prerequisites

- **Node.js** 18+ (see `.nvmrc`)
- **npm** 9+
- (Optional) **Docker** & **Docker Compose** for Conserver infrastructure
- (Optional) **Africa's Talking** account for live voice/SMS

---

## Setup Instructions

### 1. Clone and install

```bash
git clone <repo-url>
cd Patanisha
cd backend && npm install && cd ..
```

### 2. Environment variables

Create `backend/.env`:

```env
# Server
PORT=8001

# Africa's Talking (required for live voice/SMS)
AT_USERNAME=your_sandbox_username
AT_API_KEY=your_api_key
AT_FROM_NUMBER=+254711082000
BASE_URL=https://your-public-url.com

# Conserver (optional - uses local fallback if unset)
CONSERVER_URL=http://localhost:8000
CONSERVER_API_KEY=
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 8001) |
| `AT_USERNAME` | For live AT | Africa's Talking sandbox username |
| `AT_API_KEY` | For live AT | Africa's Talking API key |
| `AT_FROM_NUMBER` | For live AT | Sender number for SMS |
| `BASE_URL` | For live AT | Public URL for webhook callbacks |
| `CONSERVER_URL` | No | Conserver API for vCon processing |
| `CONSERVER_API_KEY` | No | Conserver auth (if enabled) |

### 3. Run locally

```bash
cd backend
npm start
```

Open **http://localhost:8001** — the dashboard and API run together.

**Quick demo without Africa's Talking:**

1. Click **Load TADHack Data** to load ~42 synthetic cases
2. Or click **Simulate Calls & SMS** to generate 10 sample cases

### 4. Run tests

```bash
cd backend
npm test
```

Requires the server to be running for full API tests.

---

## Docker (Optional)

For Conserver infrastructure (Redis, Postgres, vCon MCP):

```bash
# Base infra only (Redis + Postgres)
docker-compose up -d

# Full stack with Conserver (set SUPABASE_* in .env)
docker-compose --profile full up -d
```

Conserver is optional; the backend uses local fallback for vCon processing when Conserver is unavailable.

---

## Netlify Deployment

The app is configured for Netlify: static dashboard + serverless API.

### Deploy steps

1. **Connect repo** — Netlify → Add new site → Import from Git
2. **Build settings** — Picked up from `netlify.toml`:
   - Publish: `dashboard`
   - Build: `cd backend && npm install`
3. **Environment variables** — In Netlify UI, add:
   - `AT_USERNAME`, `AT_API_KEY`, `AT_FROM_NUMBER`, `BASE_URL` (for Africa's Talking)
   - `CONSERVER_URL`, `CONSERVER_API_KEY` (optional)

### Netlify notes

- **In-memory data** resets on cold starts. Use **Load TADHack Data** after a cold start.
- **TADHack load** may timeout on free tier (10s). Retry or reduce load if needed.
- **Audio** redirects to GitHub on Netlify (no streaming proxy).

### Local Netlify dev

```bash
npx netlify dev
```

Runs the site with functions locally (default port 8888).

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/cases` | List cases (query: `status`, `priority`) |
| GET | `/api/cases/:id` | Get case detail |
| POST | `/api/cases/:id/claim` | Claim case (`?agentId=`) |
| POST | `/api/cases/:id/reply` | Send SMS reply (`?message=`) |
| POST | `/api/cases/:id/resolve` | Resolve case (`?resolution=`) |
| POST | `/api/tadhack/load` | Load TADHack dataset |
| POST | `/api/simulate/batch` | Simulate cases (body: `{ count: 10 }`) |
| GET | `/audio/tadhack-audio/:day/:file` | Stream TADHack MP3 |
| POST | `/webhooks/at/voice/incoming` | Africa's Talking voice |
| POST | `/webhooks/at/voice/recorded` | Africa's Talking recording |
| POST | `/webhooks/at/sms/incoming` | Africa's Talking SMS |

---

## What's Next

### Short term

- [ ] **Persistent storage** — Replace in-memory DB with Supabase/Postgres for production
- [ ] **Auth** — Agent login and session management
- [ ] **Real-time updates** — WebSocket or polling for live case updates
- [ ] **TADHack load optimization** — Paginate or lazy-load to avoid timeout on Netlify

### Medium term

- [ ] **Multi-tenant** — Support multiple organizations/teams
- [ ] **Analytics** — Case volume, resolution time, sentiment trends
- [ ] **Export** — CSV/PDF reports and case history
- [ ] **Conserver integration** — Full vCon pipeline with transcription (Deepgram) and analysis (OpenAI) via `config/chains.yml`

### Long term

- [ ] **Additional channels** — WhatsApp, email ingestion
- [ ] **AI summarization** — Auto-summarize long threads
- [ ] **Routing rules** — Auto-assign by skill, language, priority
- [ ] **Mobile app** — Agent app for on-the-go case handling

---

## License

See repository for license details.
