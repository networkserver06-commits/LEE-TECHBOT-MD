'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../data/botIdentity.json');

function loadIdentity() {
    try {
        const value = JSON.parse(fs.readFileSync(file, 'utf8'));
        return { userName: String(value.userName || ''), ownerNumber: String(value.ownerNumber || '') };
    } catch (_) {
        return { userName: '', ownerNumber: '' };
    }
}

function saveIdentity(patch) {
    const next = { ...loadIdentity(), ...patch };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, file);
    return next;
}

module.exports = { loadIdentity, saveIdentity };
