'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const entry = path.resolve(process.env.BOT_ENTRY || path.join(process.cwd(), 'index.js'));
const authDir = path.resolve(process.env.AUTH_DIR || path.join(process.cwd(), 'session'));
const badMacPattern = /bad mac|verif(?:y|ication)mac|failed to decrypt|decrypt.*session|failed to decrypt message with any known session/i;
let alreadyRecovered = process.env.SESSION_RECOVERY_USED === '1';
let child = null;
let recovering = false;
let stopping = false;

function log(message) {
    process.stdout.write(`[session-recovery] ${message}\n`);
}

function clearSessionWithBackup() {
    if (authDir === path.parse(authDir).root || authDir === path.resolve(process.cwd())) {
        throw new Error(`Refusing unsafe AUTH_DIR: ${authDir}`);
    }
    if (!fs.existsSync(authDir)) {
        log(`Auth directory does not exist: ${authDir}`);
        return null;
    }
    const backup = `${authDir}.bad-mac-${Date.now()}`;
    fs.renameSync(authDir, backup);
    fs.mkdirSync(authDir, { recursive: true, mode: 0o700 });
    return backup;
}

function stopChild() {
    if (!child || child.killed) return;
    child.kill('SIGTERM');
    setTimeout(() => {
        if (child && !child.killed) child.kill('SIGKILL');
    }, 5000).unref();
}

function launch() {
    child = spawn(process.execPath, [entry], {
        cwd: process.cwd(),
        env: { ...process.env, SESSION_RECOVERY_USED: alreadyRecovered ? '1' : '0' },
        stdio: ['inherit', 'pipe', 'pipe']
    });

    const inspect = chunk => {
        const text = String(chunk);
        process.stdout.write(text);
        if (!recovering && !alreadyRecovered && badMacPattern.test(text)) {
            recovering = true;
            log('Signal decryption failure detected. Stopping bot and rotating the auth folder once.');
            try {
                const backup = clearSessionWithBackup();
                log(`Old auth folder backed up to ${backup || '(none)'}. Restarting with a fresh session.`);
                stopChild();
            } catch (error) {
                console.error(`[session-recovery] Could not clear auth folder: ${error.message}`);
                stopChild();
            }
        } else if (alreadyRecovered && badMacPattern.test(text)) {
            log('Bad MAC happened again after recovery. No further automatic reset will be attempted.');
        }
    };

    child.stdout.on('data', inspect);
    child.stderr.on('data', inspect);
    child.on('error', error => console.error(`[session-recovery] Child error: ${error.message}`));
    child.on('close', (code, signal) => {
        child = null;
        if (stopping) process.exit(code || 0);
        if (recovering) {
            recovering = false;
            alreadyRecovered = true;
            process.env.SESSION_RECOVERY_USED = '1';
            launch();
            return;
        }
        if (alreadyRecovered && code !== 0) {
            log(`Bot stopped after the one recovery attempt (code=${code}, signal=${signal || 'none'}). Link the device manually after checking the backup.`);
        }
        process.exit(code ?? 0);
    });
}

process.on('SIGINT', () => { stopping = true; stopChild(); });
process.on('SIGTERM', () => { stopping = true; stopChild(); });

if (!fs.existsSync(entry)) {
    console.error(`[session-recovery] Bot entrypoint not found: ${entry}`);
    process.exit(1);
}
launch();
