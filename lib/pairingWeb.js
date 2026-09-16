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

function connectionSnapshot(socket) {
    const registered = Boolean(socket?.authState?.creds?.registered);
    const ready = socket?.ws?.readyState === 1;
    const user = socket?.user || {};
    const id = String(user.id || '');
    return { connected: registered && ready, registered, state: registered && ready ? 'connected' : registered ? 'starting' : 'pairing', name: user.name || user.verifiedName || 'LEE TECH BOT', number: id.split(':')[0].split('@')[0] || '' };
}

function connectedPage(status) {
    const safe = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="20"><title>LEE TECH BOT · Connected</title><style>:root{color-scheme:dark;--bg:#08111f;--card:#101d31;--line:#263a58;--text:#edf5ff;--muted:#9eb0c9;--accent:#55d6be}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 20% 0,#183254 0,#08111f 48%);font:16px system-ui,-apple-system,Segoe UI,sans-serif;color:var(--text)}main{width:min(100%,620px)}.brand{letter-spacing:.12em;color:var(--accent);font-weight:800;font-size:.82rem}.card{margin-top:12px;padding:28px;border:1px solid var(--line);border-radius:24px;background:rgba(16,29,49,.94);box-shadow:0 20px 80px #0006}h1{margin:8px 0 10px;font-size:2rem}.badge{display:inline-block;padding:7px 12px;border-radius:999px;background:#123f3a;color:var(--accent);font-weight:800;text-transform:uppercase;font-size:.78rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:24px 0}.item{padding:15px;border:1px solid var(--line);border-radius:14px;background:#0a1527}.label{display:block;color:var(--muted);font-size:.8rem;margin-bottom:5px}.value{font-weight:700;overflow-wrap:anywhere}p,small{color:var(--muted);line-height:1.5}button{padding:12px 16px;border:1px solid #39617c;border-radius:12px;background:#18354a;color:var(--text);font-weight:700;cursor:pointer}</style></head><body><main><div class="brand">LEE TECH BOT</div><section class="card"><span class="badge">● WhatsApp connected</span><h1>${safe(status.name)}</h1><p>Your account is connected and the bot is ready to receive commands. This dashboard replaces the pairing form while the session is active.</p><div class="grid"><div class="item"><span class="label">Connection</span><span class="value">Online</span></div><div class="item"><span class="label">Account</span><span class="value">${safe(status.number || 'Linked account')}</span></div><div class="item"><span class="label">Session</span><span class="value">Registered</span></div><div class="item"><span class="label">Dashboard</span><span class="value">Live status</span></div></div><button onclick="location.reload()">Refresh status</button><small>Updates automatically every 20 seconds. The pairing form returns if the bot disconnects or the session is reset.</small></section></main></body></html>`;
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
            const status = connectionSnapshot(getSocket?.());
            return res.end(status.connected ? connectedPage(status) : fs.readFileSync(pagePath));
        }
        if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, service: 'pairing-web', ...connectionSnapshot(getSocket?.()) });
        if (req.method === 'GET' && req.url === '/api/status') return json(res, 200, connectionSnapshot(getSocket?.()));
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
