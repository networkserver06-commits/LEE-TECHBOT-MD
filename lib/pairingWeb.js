'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { normalizeWhatsAppNumber } = require('./phone');
const { requestPairingCodeWithRetry } = require('./pairing');

const pagePath = path.join(__dirname, '../web/pairing/index.html');

function json(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(body);
}

function createPairingWebServer({ getSocket, enabled = true, host = '127.0.0.1', port = 3000, token = '', logger = console } = {}) {
    if (!enabled) return null;
    if (host !== '127.0.0.1' && host !== 'localhost' && !token) {
        logger.warn?.('PAIRING_WEB_TOKEN is empty; the public pairing website is rate-limited but unauthenticated.');
    }
    const rate = new Map();
    let requestInFlight = false;
    const server = http.createServer(async (req, res) => {
        const remote = req.socket.remoteAddress || 'unknown';
        if (token && req.url === '/api/pairing-code' && req.headers['x-pairing-token'] !== token) return json(res, 401, { error: 'Unauthorized' });
        if (req.method === 'GET' && req.url === '/') {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
            return res.end(fs.readFileSync(pagePath));
        }
        if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, service: 'pairing-web' });
        if (req.method !== 'POST' || req.url !== '/api/pairing-code') return json(res, 404, { error: 'Not found' });
        if (requestInFlight) return json(res, 409, { error: 'A pairing-code request is already in progress.' });
        const last = rate.get(remote) || 0;
        if (Date.now() - last < 15000) return json(res, 429, { error: 'Please wait 15 seconds before requesting another code.' });
        let body = '';
        for await (const chunk of req) {
            body += chunk;
            if (body.length > 2048) return json(res, 413, { error: 'Request too large.' });
        }
        let input;
        try { input = JSON.parse(body || '{}'); } catch (_) { return json(res, 400, { error: 'Send JSON with a phoneNumber field.' }); }
        const phoneNumber = normalizeWhatsAppNumber(input.phoneNumber);
        if (!phoneNumber) return json(res, 400, { error: 'Enter a valid international phone number without +, spaces, or dashes.' });
        const socket = getSocket?.();
        if (!socket || socket.authState?.creds?.registered) return json(res, 503, { error: 'Pairing is unavailable. Start a fresh unregistered bot session.' });
        if (!socket.__pairingReady) return json(res, 503, { error: 'WhatsApp connection is still starting. Wait a few seconds and try again.' });
        requestInFlight = true;
        rate.set(remote, Date.now());
        try {
            const code = await requestPairingCodeWithRetry({ socket, phoneNumber, isActive: () => getSocket?.() === socket, logger });
            if (!code) return json(res, 409, { error: 'The WhatsApp socket closed before a code was generated.' });
            return json(res, 200, { ok: true, phoneNumber: `${phoneNumber.slice(0, 3)}••••••${phoneNumber.slice(-2)}`, code });
        } catch (error) {
            logger.error?.('[pairing-web]', error.message || error);
            return json(res, 502, { error: 'WhatsApp did not return a pairing code. Keep the bot running and try again.' });
        } finally {
            requestInFlight = false;
        }
    });
    server.on('error', (error) => logger.error?.(`[pairing-web] ${error.message || error}`));
    server.listen(Number(port), host, () => logger.log?.(`Pairing website available at http://${host}:${server.address().port}`));
    return server;
}

module.exports = { createPairingWebServer };
