'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');

const execFileAsync = promisify(execFile);
const DEFAULT_UPDATE_ZIP_URL = 'https://github.com/networkserver06-commits/LEE-TECHBOT-MD/archive/refs/heads/main.zip';
const MAX_UPDATE_BYTES = 50 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_REDIRECTS = 5;
const PRESERVED_NAMES = new Set([
    '.git', '.env', 'node_modules', 'session', 'sessions', 'auth', 'auth_info',
    'tmp', 'temp', 'data', 'baileys_store.json', 'package-lock.json'
]);

function shellCommand(command, args, options = {}) {
    return execFileAsync(command, args, {
        cwd: process.cwd(),
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
        ...options
    }).then(({ stdout = '' }) => String(stdout));
}

function isSafeUpdateUrl(value) {
    try {
        const url = new URL(String(value));
        return url.protocol === 'https:' && Boolean(url.hostname);
    } catch {
        return false;
    }
}

function removeFile(file) {
    try { fs.rmSync(file, { recursive: true, force: true }); } catch {}
}

function downloadFile(url, destination, options = {}, redirects = 0, visited = new Set()) {
    const timeout = options.timeout || REQUEST_TIMEOUT_MS;
    const maxBytes = options.maxBytes || MAX_UPDATE_BYTES;

    return new Promise((resolve, reject) => {
        let parsed;
        try { parsed = new URL(url); } catch { return reject(new Error('Invalid update URL')); }
        if (parsed.protocol !== 'https:') return reject(new Error('Updates must use HTTPS'));
        if (redirects > MAX_REDIRECTS || visited.has(parsed.href)) return reject(new Error('Too many redirects'));
        visited.add(parsed.href);

        const client = parsed.protocol === 'https:' ? https : http;
        const request = client.get(parsed, {
            headers: { 'User-Agent': 'LEE-TECHBot-Updater/2.1', Accept: 'application/zip,application/octet-stream;q=0.9,*/*;q=0.1' },
            timeout
        }, response => {
            const status = response.statusCode || 0;
            if ([301, 302, 303, 307, 308].includes(status)) {
                const location = response.headers.location;
                response.resume();
                if (!location) return reject(new Error(`HTTP ${status} without redirect location`));
                return downloadFile(new URL(location, parsed).href, destination, options, redirects + 1, visited)
                    .then(resolve, reject);
            }
            if (status !== 200) {
                response.resume();
                return reject(new Error(`Update download failed with HTTP ${status}`));
            }

            const declaredLength = Number(response.headers['content-length'] || 0);
            if (declaredLength > maxBytes) {
                response.resume();
                return reject(new Error(`Update archive is too large (maximum ${maxBytes} bytes)`));
            }

            const temporary = `${destination}.part`;
            removeFile(temporary);
            const output = fs.createWriteStream(temporary, { flags: 'wx' });
            let received = 0;
            let settled = false;
            const fail = error => {
                if (settled) return;
                settled = true;
                response.destroy();
                output.destroy();
                removeFile(temporary);
                reject(error);
            };
            response.on('data', chunk => {
                received += chunk.length;
                if (received > maxBytes) fail(new Error(`Update archive is too large (maximum ${maxBytes} bytes)`));
            });
            response.on('error', fail);
            output.on('error', fail);
            output.on('finish', () => {
                if (settled) return;
                settled = true;
                try {
                    fs.renameSync(temporary, destination);
                    resolve({ bytes: received });
                } catch (error) {
                    removeFile(temporary);
                    reject(error);
                }
            });
            response.pipe(output);
        });
        request.on('timeout', () => request.destroy(new Error('Update download timed out')));
        request.on('error', error => reject(error));
    });
}

async function runGit(args) {
    return shellCommand('git', args);
}

async function hasGitRepo() {
    try {
        return fs.existsSync(path.join(process.cwd(), '.git')) && (await runGit(['--version']));
    } catch {
        return false;
    }
}

async function updateViaGit() {
    const oldRev = (await runGit(['rev-parse', 'HEAD'])).trim();
    const status = (await runGit(['status', '--porcelain', '--untracked-files=no'])).trim();
    if (status && process.env.UPDATE_ALLOW_DIRTY !== 'true') {
        throw new Error('Working tree has local changes. Commit or back them up first, or set UPDATE_ALLOW_DIRTY=true.');
    }

    await runGit(['fetch', '--all', '--prune']);
    const newRev = (await runGit(['rev-parse', 'origin/main'])).trim();
    if (!/^[0-9a-f]{40}$/i.test(newRev)) throw new Error('Remote update returned an invalid revision');
    const alreadyUpToDate = oldRev === newRev;
    const commits = alreadyUpToDate ? '' : await runGit(['log', '--pretty=format:%h %s (%an)', `${oldRev}..${newRev}`]);
    const files = alreadyUpToDate ? '' : await runGit(['diff', '--name-status', oldRev, newRev]);

    if (!alreadyUpToDate) {
        const backupRef = `refs/lee-techbot/backup-${Date.now()}`;
        await runGit(['branch', backupRef, oldRev]);
        await runGit(['reset', '--hard', newRev]);
        // Never delete untracked files during a remote update.
        return { oldRev, newRev, alreadyUpToDate, commits, files, backupRef };
    }
    return { oldRev, newRev, alreadyUpToDate, commits, files, backupRef: '' };
}

function assertInside(root, candidate) {
    const resolvedRoot = path.resolve(root) + path.sep;
    const resolvedCandidate = path.resolve(candidate);
    if (!resolvedCandidate.startsWith(resolvedRoot)) throw new Error('Unsafe archive entry detected');
}

function copyRecursive(src, dest, relative = '', outList = []) {
    assertInside(process.cwd(), dest);
    const stat = fs.lstatSync(src);
    if (stat.isSymbolicLink()) throw new Error(`Refusing symbolic link in update archive: ${relative}`);
    if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src)) {
            if (relative === '' && PRESERVED_NAMES.has(entry)) continue;
            copyRecursive(path.join(src, entry), path.join(dest, entry), path.join(relative, entry), outList);
        }
        return;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    outList.push(relative.replace(/\\/g, '/'));
}

async function extractZip(zipPath, outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    if (process.platform === 'win32') {
        await shellCommand('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force`]);
        return;
    }
    try {
        await shellCommand('unzip', ['-oq', zipPath, '-d', outDir]);
        return;
    } catch {}
    try {
        await shellCommand('7z', ['x', '-y', zipPath, `-o${outDir}`]);
        return;
    } catch {}
    throw new Error('No supported archive extractor found (unzip or 7z)');
}

async function updateViaZip(zipOverride) {
    const zipUrl = String(zipOverride || settings.updateZipUrl || process.env.UPDATE_ZIP_URL || DEFAULT_UPDATE_ZIP_URL).trim();
    if (!isSafeUpdateUrl(zipUrl)) throw new Error('Update URL must be a valid HTTPS URL');

    const tmpDir = path.join(process.cwd(), 'tmp');
    const zipPath = path.join(tmpDir, `update-${process.pid}-${Date.now()}.zip`);
    const extractTo = path.join(tmpDir, `update-extract-${process.pid}-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
        await downloadFile(zipUrl, zipPath);
        await extractZip(zipPath, extractTo);
        const entries = fs.readdirSync(extractTo).map(name => path.join(extractTo, name));
        const directories = entries.filter(entry => fs.lstatSync(entry).isDirectory());
        const srcRoot = directories.length === 1 ? directories[0] : extractTo;
        const copied = [];
        copyRecursive(srcRoot, process.cwd(), '', copied);
        return { copiedFiles: copied, source: zipUrl };
    } finally {
        removeFile(zipPath);
        removeFile(`${zipPath}.part`);
        removeFile(extractTo);
    }
}

async function restartProcess(sock) {
    global.__updateRestarting = true;
    try {
        sock?.ev?.removeAllListeners?.();
        sock?.ws?.close?.();
        sock?.end?.(new Error('Update restart handoff'));
    } catch (error) {
        console.warn('[update] Socket close warning:', error.message || error);
    }
    const mode = String(process.env.RESTART_MODE || 'auto').toLowerCase();
    if (mode === 'none') return;
    if (process.env.RESTART_COMMAND) {
        await shellCommand(process.env.SHELL || '/bin/sh', ['-c', process.env.RESTART_COMMAND]);
        setTimeout(() => process.exit(0), 1500);
        return;
    }
    const isPanel = Boolean(process.env.P_SERVER_UUID || process.env.PTERODACTYL_SERVER_UUID || process.env.KATABUMP_SERVER_ID || process.env.KATABUMP);
    if (mode !== 'panel' && (process.env.pm_id || process.env.PM2_HOME || mode === 'pm2' || process.env.PM2_APP_NAME)) {
        const appName = String(process.env.PM2_APP_NAME || 'leetechbot').replace(/[^a-zA-Z0-9_.-]/g, '');
        try {
            await shellCommand('pm2', ['restart', appName]);
            setTimeout(() => process.exit(0), 1500);
            return;
        } catch (error) {
            if (mode === 'pm2' || process.env.pm_id || process.env.PM2_HOME) {
                console.warn('[update] PM2 restart unavailable:', error.message || error);
                setTimeout(() => process.exit(0), 1800);
                return;
            }
        }
    }
    if (mode === 'panel' || isPanel) {
        setTimeout(() => process.exit(0), 1800);
        return;
    }
    // Direct Node deployments should use a process supervisor. Do not spawn a
    // second bot process, which can duplicate WhatsApp connections.
    console.warn('[update] No process supervisor configured; restart skipped.');
}

async function updateCommand(sock, chatId, message, zipOverride) {
    const senderId = message.key.participant || message.key.remoteJid;
    const owner = await isOwnerOrSudo(senderId, sock, chatId);
    if (!message.key.fromMe && !owner) {
        await sock.sendMessage(chatId, { text: 'Only bot owner or sudo can use .update' }, { quoted: message });
        return;
    }
    try {
        await sock.sendMessage(chatId, { text: '🔄 *Update started*\nChecking the latest repository revision…' }, { quoted: message });
        let result;
        if (await hasGitRepo()) {
            try { result = await updateViaGit(); }
            catch (error) { console.warn('[update] Git update unavailable:', error.message); }
        }
        if (!result) {
            await sock.sendMessage(chatId, { text: '📦 Git is unavailable or the working tree is busy; downloading a safe archive fallback…' }, { quoted: message }).catch(() => {});
            result = await updateViaZip(zipOverride);
        }
        if (result.alreadyUpToDate) {
            await sock.sendMessage(chatId, { text: `ℹ️ Already up to date.\nRevision: *${result.newRev.slice(0, 12)}*\nNo files changed and no restart was needed.` }, { quoted: message });
            return;
        }
        await sock.sendMessage(chatId, { text: '✅ Source updated. Installing dependencies and validating the installation…' }, { quoted: message });
        await shellCommand('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts']);
        const packagePath = path.join(process.cwd(), 'package.json');
        let version = settings.version || 'unknown';
        try { version = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version || version; } catch {}
        await sock.sendMessage(chatId, { text: `✅ *Update completed*\nVersion: *${version}*\nRevision: *${result.newRev ? result.newRev.slice(0, 12) : 'archive'}*\nRestarting only if a supervisor is configured.` }, { quoted: message });
        await new Promise(resolve => setTimeout(resolve, 1200));
        await restartProcess(sock);
    } catch (error) {
        console.error('[update] failed:', error);
        await sock.sendMessage(chatId, { text: `❌ Update failed safely:\n${String(error.message || error).slice(0, 800)}` }, { quoted: message });
    }
}

module.exports = updateCommand;
module.exports.isSafeUpdateUrl = isSafeUpdateUrl;
module.exports.downloadFile = downloadFile;
module.exports.updateViaGit = updateViaGit;
module.exports.updateViaZip = updateViaZip;
module.exports.copyRecursive = copyRecursive;
