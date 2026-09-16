'use strict';

const fs = require('fs');
const path = require('path');

const statePath = path.join(__dirname, '../data/runtimeSettings.json');
const defaults = {
    autodlState: 'off',
    antispamState: 'off',
    autobioState: 'off',
    alwaysOnlineState: 'off',
    antistatusState: {},
    antifakeState: {},
    antibotState: {}
};

function cloneDefaults() {
    return JSON.parse(JSON.stringify(defaults));
}

function loadRuntimeSettings() {
    try {
        const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        return { ...cloneDefaults(), ...parsed };
    } catch (_) {
        return cloneDefaults();
    }
}

function snapshotRuntimeSettings() {
    return {
        autodlState: global.autodlState || 'off',
        antispamState: global.antispamState || 'off',
        autobioState: global.autobioState || 'off',
        alwaysOnlineState: global.alwaysOnlineState || 'off',
        antistatusState: global.antistatusState || {},
        antifakeState: global.antifakeState || {},
        antibotState: global.antibotState || {}
    };
}

function persistRuntimeSettings() {
    const dir = path.dirname(statePath);
    fs.mkdirSync(dir, { recursive: true });
    const temporaryPath = `${statePath}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(snapshotRuntimeSettings(), null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporaryPath, statePath);
}

function hydrateRuntimeSettings() {
    const state = loadRuntimeSettings();
    global.autodlState = state.autodlState;
    global.antispamState = state.antispamState;
    global.autobioState = state.autobioState;
    global.alwaysOnlineState = state.alwaysOnlineState;
    global.antistatusState = state.antistatusState;
    global.antifakeState = state.antifakeState;
    global.antibotState = state.antibotState;
    return state;
}

module.exports = { statePath, loadRuntimeSettings, snapshotRuntimeSettings, persistRuntimeSettings, hydrateRuntimeSettings };
