const express = require('express');
const axios = require('axios');
const router = express.Router();

// Stream MP3 from GitHub (path: dayDir/filename e.g. 18/xxx.mp3)
// On Netlify (serverless), redirect to GitHub for streaming; otherwise buffer/stream
router.get('/tadhack-audio/:dayDir/:filename', async (req, res) => {
    const { dayDir, filename } = req.params;
    const pathParam = `${dayDir}/${filename}`;
    const githubBase = 'https://raw.githubusercontent.com/vcon-dev/tadhack-2025/main';
    const githubUrl = `${githubBase}/${pathParam}`;
    
    // Serverless: redirect to GitHub (avoids streaming/buffer limits)
    if (process.env.NETLIFY) {
        return res.redirect(302, githubUrl);
    }
    
    try {
        const response = await axios({
            method: 'get',
            url: githubUrl,
            responseType: 'stream',
            timeout: 30000,
            headers: {
                'Accept': 'audio/mpeg, audio/*'
            }
        });
        
        res.set('Content-Type', 'audio/mpeg');
        res.set('Accept-Ranges', 'bytes');
        res.set('Content-Disposition', `inline; filename="${filename}"`);
        
        if (req.headers.range) {
            res.set('Content-Range', response.headers['content-range']);
            res.status(206);
        }
        
        response.data.pipe(res);
        
        response.data.on('error', (err) => {
            console.error('Stream error:', err);
            if (!res.headersSent) {
                res.status(500).end();
            }
        });
        
    } catch (error) {
        console.error('Audio streaming error:', error.message);
        
        if (error.response?.status === 404) {
            res.status(404).json({
                error: 'Audio file not found',
                path: pathParam,
                url: githubUrl
            });
        } else {
            res.status(500).json({ 
                error: 'Failed to stream audio',
                message: error.message
            });
        }
    }
});

// Health check for audio service
router.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        service: 'audio-streaming',
        tadhack_repo: 'https://github.com/vcon-dev/tadhack-2025'
    });
});

module.exports = router;