const serverless = require('serverless-http');
const path = require('path');

// Ensure Netlify env for server.js
process.env.NETLIFY = 'true';

// Load backend app (backend expects to be required from project root context)
const app = require('../../backend/server');

exports.handler = serverless(app);
