'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeWhatsAppNumber } = require('./phone');
const { requestPairingCodeWithRetry } = require('./pairing');

const pagePath = path.join(__dirname, '../web/pairing/index.html');
const PASSWORD_FILE_NAME = '.pairing-web-password.json';
const SESSION_COOKIE = 'pairing_web_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

function json(res, status, payload, headers = {}) {
    const body = JSON.stringify(payload);
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
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
    const initial = JSON.stringify(status).replace(/</g, '\\u003c');
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LEE TECH BOT · Status</title>
<style>:root{color-scheme:dark;--bg:#08111f;--card:#101d31;--line:#263a58;--text:#edf5ff;--muted:#9eb0c9;--accent:#55d6be;--warn:#ffcc66}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 20% 0,#183254 0,#08111f 48%);font:16px system-ui,-apple-system,Segoe UI,sans-serif;color:var(--text)}main{width:min(100%,620px)}.brand{letter-spacing:.12em;color:var(--accent);font-weight:800;font-size:.82rem}.card{margin-top:12px;padding:28px;border:1px solid var(--line);border-radius:24px;background:rgba(16,29,49,.94);box-shadow:0 20px 80px #0006}h1{margin:8px 0 10px;font-size:2rem}.badge{display:inline-block;padding:7px 12px;border-radius:999px;background:#123f3a;color:var(--accent);font-weight:800;text-transform:uppercase;font-size:.78rem}.badge.warn{background:#493c1d;color:var(--warn)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:24px 0}.item{padding:15px;border:1px solid var(--line);border-radius:14px;background:#0a1527}.label{display:block;color:var(--muted);font-size:.8rem;margin-bottom:5px}.value{font-weight:700;overflow-wrap:anywhere}p,small{color:var(--muted);line-height:1.5}button{padding:12px 16px;border:1px solid #39617c;border-radius:12px;background:#18354a;color:var(--text);font-weight:700;cursor:pointer}button:disabled{opacity:.55;cursor:wait}.actions{display:flex;gap:10px;flex-wrap:wrap}.actions button{flex:1;min-width:160px}.hidden{display:none}</style></head>
<body><main><div class="brand">LEE TECH BOT · PROTECTED STATUS</div><section class="card">
<span id="badge" class="badge">Loading status</span><h1 id="name">${status.name || 'LEE TECH BOT'}</h1><p id="description">Checking the WhatsApp connection…</p>
<div class="grid"><div class="item"><span class="label">Connection</span><span id="connection" class="value">Checking…</span></div><div class="item"><span class="label">Account</span><span id="account" class="value">${status.number || 'Not linked'}</span></div><div class="item"><span class="label">Session</span><span id="session" class="value">${status.registered ? 'Registered' : 'Waiting for pairing'}</span></div><div class="item"><span class="label">Last checked</span><span id="checked" class="value">—</span></div></div>
<div class="actions"><button id="refresh" type="button">Refresh status</button><button id="unlock" class="hidden" type="button">Enter password again</button></div><div id="status" role="status"><small>Status updates automatically every 5 seconds.</small></div></section></main>
<script>
const initial=${initial};const badge=document.querySelector('#badge'),name=document.querySelector('#name'),description=document.querySelector('#description'),connection=document.querySelector('#connection'),account=document.querySelector('#account'),session=document.querySelector('#session'),checked=document.querySelector('#checked'),statusText=document.querySelector('#status'),refresh=document.querySelector('#refresh'),unlock=document.querySelector('#unlock');
function render(data){const online=data.connected;badge.textContent=online?'● WhatsApp connected':data.registered?'○ WhatsApp reconnecting':'○ Waiting for pairing';badge.className='badge'+(online?'':' warn');name.textContent=data.name||'LEE TECH BOT';description.textContent=online?'Your account is connected and the bot is ready.':data.registered?'WhatsApp is disconnected. The bot is attempting to reconnect automatically.':'Create or use the pairing form after authentication to link this host.';connection.textContent=online?'Online':data.registered?'Reconnecting':'Waiting for pairing';account.textContent=data.number||'Not linked';session.textContent=data.registered?'Registered':'Waiting for pairing';checked.textContent=new Date().toLocaleTimeString();}
async function update(){try{const response=await fetch('/api/status',{cache:'no-store'});if(response.status===401){description.textContent='Your web session was cleared. Enter the website password again to continue.';unlock.classList.remove('hidden');statusText.textContent='Authentication required.';return}if(!response.ok)throw new Error('Status request failed');render(await response.json());statusText.innerHTML='<small>Live status · updates every 5 seconds</small>'}catch(error){badge.textContent='○ Status unavailable';badge.className='badge warn';description.textContent='Unable to read the protected status. The host may be restarting.';statusText.textContent=error.message}}
refresh.onclick=update;unlock.onclick=()=>location.reload();render(initial);update();setInterval(update,5000);
</script></body></html>`;
}

function passwordFilePath(value) {
    const root = path.resolve(String(value || process.env.AUTH_DIR || './session'));
    if (root === path.parse(root).root || root === path.resolve(process.cwd())) throw new Error(`unsafe pairing password directory: ${root}`);
    return path.join(root, PASSWORD_FILE_NAME);
}

function readPasswordRecord(file) {
    try {
        const record = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (record?.algorithm === 'scrypt' && record.salt && record.hash) return record;
    } catch (_) {}
    return null;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    return { algorithm: 'scrypt', salt, hash: crypto.scryptSync(password, salt, 64).toString('hex'), createdAt: new Date().toISOString() };
}

function passwordMatches(password, record) {
    try {
        const actual = crypto.scryptSync(password, record.salt, 64);
        const expected = Buffer.from(record.hash, 'hex');
        return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
    } catch (_) { return false; }
}

function savePasswordRecord(file, password) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(hashPassword(password), null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, file);
    try { fs.chmodSync(file, 0o600); } catch (_) {}
}

function parseCookies(req) {
    return Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => part.trim().split('=')) .filter(([key, value]) => key && value).map(([key, ...value]) => [key, decodeURIComponent(value.join('='))]));
}

function createPairingWebServer({ getSocket, enabled = true, host = '127.0.0.1', port = 3000, token = '', authDir = process.env.AUTH_DIR || './session', logger = console } = {}) {
    if (!enabled) return null;
    const passwordFile = passwordFilePath(authDir);
    const sessions = new Map();
    const rate = new Map();
    let requestInFlight = false;
    const sessionIsValid = (req) => {
        const value = sessions.get(parseCookies(req)[SESSION_COOKIE]);
        return Boolean(value && value > Date.now());
    };
    const authenticated = (req, res) => {
        if (!sessionIsValid(req)) { json(res, 401, { error: 'Website password required.' }); return false; }
        return true;
    };
    const issueSession = (res) => {
        const session = crypto.randomBytes(32).toString('hex');
        sessions.set(session, Date.now() + SESSION_TTL_MS);
        res.setHeader('set-cookie', `${SESSION_COOKIE}=${encodeURIComponent(session)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
    };
    const clearWebSessions = (reason = 'connection change', resetPassword = false) => {
        sessions.clear();
        rate.clear();
        requestInFlight = false;
        if (resetPassword) {
            try { fs.rmSync(passwordFile, { force: true }); }
            catch (error) { logger.error?.(`[pairing-web] Could not reset host password: ${error.message}`); }
        }
        logger.log?.(`[pairing-web] Cleared browser sessions after ${reason}${resetPassword ? ' and reset the host password' : ''}.`);
    };
    const server = http.createServer(async (req, res) => {
        const remote = req.socket.remoteAddress || 'unknown';
        const route = String(req.url || '').split('?')[0];
        if (req.method === 'GET' && route === '/') {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
            return res.end(sessionIsValid(req) ? (() => { const socket = getSocket?.(); return socket?.authState?.creds?.registered ? connectedPage(connectionSnapshot(socket)) : fs.readFileSync(pagePath); })() : fs.readFileSync(pagePath));
        }
        if (req.method === 'POST' && route === '/api/auth') {
            let body = '';
            for await (const chunk of req) { body += chunk; if (body.length > 4096) return json(res, 413, { error: 'Request too large.' }); }
            let input; try { input = JSON.parse(body || '{}'); } catch (_) { return json(res, 400, { error: 'Send JSON credentials.' }); }
            const password = typeof input.password === 'string' ? input.password : '';
            const confirm = typeof input.confirmPassword === 'string' ? input.confirmPassword : '';
            let record = readPasswordRecord(passwordFile);
            if (!record) {
                if (password.length < MIN_PASSWORD_LENGTH) return json(res, 400, { error: `Create a password with at least ${MIN_PASSWORD_LENGTH} characters.` });
                if (password !== confirm) return json(res, 400, { error: 'Passwords do not match.' });
                try { savePasswordRecord(passwordFile, password); } catch (error) { logger.error?.('[pairing-web] Could not save password:', error.message); return json(res, 500, { error: 'Could not save the host password.' }); }
                issueSession(res);
                return json(res, 200, { ok: true, created: true, paired: Boolean(getSocket?.()?.authState?.creds?.registered) });
            }
            if (!passwordMatches(password, record)) return json(res, 401, { error: 'Incorrect website password.' });
            issueSession(res);
            return json(res, 200, { ok: true, created: false, paired: Boolean(getSocket?.()?.authState?.creds?.registered) });
        }
        if (route === '/health' || route === '/api/status') {
            if (!authenticated(req, res)) return;
            const snapshot = connectionSnapshot(getSocket?.());
            return route === '/health' ? json(res, 200, { ok: true, service: 'pairing-web', ...snapshot }) : json(res, 200, snapshot);
        }
        if (req.method !== 'POST' || route !== '/api/pairing-code') return json(res, 404, { error: 'Not found' });
        if (!authenticated(req, res)) return;
        if (token && req.headers['x-pairing-token'] !== token) return json(res, 401, { error: 'Invalid website token.' });
        if (requestInFlight) return json(res, 409, { error: 'A pairing-code request is already in progress.' });
        const last = rate.get(remote) || 0;
        if (Date.now() - last < 15000) return json(res, 429, { error: 'Please wait 15 seconds before requesting another code.' });
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 2048) return json(res, 413, { error: 'Request too large.' }); }
        let input; try { input = JSON.parse(body || '{}'); } catch (_) { return json(res, 400, { error: 'Send JSON with a phoneNumber field.' }); }
        const phoneNumber = normalizeWhatsAppNumber(input.phoneNumber);
        if (!phoneNumber) return json(res, 400, { error: 'Enter a valid international phone number without +, spaces, or dashes.' });
        const socket = getSocket?.();
        if (!socket) return json(res, 503, { error: 'WhatsApp is reconnecting. Refresh the page and try again when the session is ready.' });
        if (socket.authState?.creds?.registered) return json(res, 409, { error: 'This WhatsApp account is already linked. Refresh the status page; pairing requires a fresh unregistered session.' });
        requestInFlight = true;
        rate.set(remote, Date.now());
        try {
            const code = await requestPairingCodeWithRetry({ socket, phoneNumber, isActive: () => getSocket?.() === socket, logger });
            if (!code) return json(res, 409, { error: 'The WhatsApp socket closed before a code was generated.' });
            return json(res, 200, { ok: true, phoneNumber: `${phoneNumber.slice(0, 3)}••••••${phoneNumber.slice(-2)}`, code });
        } catch (error) {
            logger.error?.('[pairing-web]', error.message || error);
            return json(res, 502, { error: 'WhatsApp did not return a pairing code. Keep the bot running and try again.' });
        } finally { requestInFlight = false; }
    });
    server.on('error', (error) => logger.error?.(`[pairing-web] ${error.message || error}`));
    server.listen(Number(port), host, () => logger.log?.(`Pairing website available at http://${host}:${server.address().port}`));
    server.pairingPasswordFile = passwordFile;
    server.clearWebSessions = clearWebSessions;
    return server;
}

module.exports = { createPairingWebServer, passwordFilePath, hashPassword, passwordMatches, MIN_PASSWORD_LENGTH };
