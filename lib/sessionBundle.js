'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MARKER_NAME = '.session-bundle-import.json';
const MAX_BUNDLE_BYTES = 2 * 1024 * 1024;

function encodeBundle(files) {
    const payload = Buffer.from(JSON.stringify({ version: 1, files }), 'utf8');
    if (payload.length > MAX_BUNDLE_BYTES) throw new Error('SESSION_BUNDLE is too large (maximum 2 MiB before compression).');
    return zlib.gzipSync(payload, { level: 9 }).toString('base64url');
}

function decodeBundle(bundle) {
    const raw = Buffer.from(String(bundle || '').trim(), 'base64url');
    if (!raw.length || raw.length > MAX_BUNDLE_BYTES) throw new Error('SESSION_BUNDLE is empty or too large.');
    let parsed;
    try { parsed = JSON.parse(zlib.gunzipSync(raw).toString('utf8')); }
    catch { throw new Error('SESSION_BUNDLE is invalid or corrupted.'); }
    if (parsed?.version !== 1 || !parsed.files || typeof parsed.files !== 'object') throw new Error('SESSION_BUNDLE format is not supported.');
    return parsed.files;
}

function collectFiles(root, current = root, output = {}) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        const relative = path.relative(root, full).replace(/\\/g, '/');
        if (relative === MARKER_NAME || relative.includes('..') || path.isAbsolute(relative)) continue;
        if (entry.isDirectory()) collectFiles(root, full, output);
        else if (entry.isFile()) output[relative] = fs.readFileSync(full).toString('base64');
    }
    return output;
}

function packSessionDirectory(root) {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error('Session directory does not exist.');
    return encodeBundle(collectFiles(root));
}

function safeRelative(relative) {
    const normalized = String(relative || '').replace(/\\/g, '/');
    return normalized && normalized !== '.' && !normalized.startsWith('/') && !normalized.split('/').includes('..') && !normalized.includes('\0') ? normalized : null;
}

function restoreSessionBundle(bundle, root) {
    const value = String(bundle || '').trim();
    if (!value) return { imported: false, reason: 'missing' };
    const digest = crypto.createHash('sha256').update(value).digest('hex');
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    const markerPath = path.join(root, MARKER_NAME);
    try {
        const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
        if (marker.bundleSha256 === digest && fs.existsSync(path.join(root, 'creds.json'))) return { imported: false, reason: 'already-imported', digest };
    } catch {}
    const files = decodeBundle(value);
    if (!files['creds.json']) throw new Error('SESSION_BUNDLE does not contain creds.json.');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    for (const [relative, encoded] of Object.entries(files)) {
        const safe = safeRelative(relative);
        if (!safe || typeof encoded !== 'string') throw new Error('SESSION_BUNDLE contains an unsafe file path.');
        const target = path.resolve(root, safe);
        if (target !== path.resolve(root) && !target.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error('SESSION_BUNDLE path escapes AUTH_DIR.');
        fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
        fs.writeFileSync(target, Buffer.from(encoded, 'base64'), { mode: 0o600 });
    }
    fs.writeFileSync(markerPath, JSON.stringify({ bundleSha256: digest, importedAt: new Date().toISOString() }), { mode: 0o600 });
    return { imported: true, digest, files: Object.keys(files).length };
}

module.exports = { decodeBundle, encodeBundle, packSessionDirectory, restoreSessionBundle, MAX_BUNDLE_BYTES };
