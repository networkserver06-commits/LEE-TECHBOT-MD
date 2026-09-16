'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { statePath, persistRuntimeSettings, hydrateRuntimeSettings } = require('../lib/runtimeSettings');

test('runtime settings survive a process restart hydration', () => {
    const existed = fs.existsSync(statePath);
    const previousFile = existed ? fs.readFileSync(statePath) : null;
    const previous = {
        autodlState: global.autodlState,
        antispamState: global.antispamState,
        autobioState: global.autobioState,
        alwaysOnlineState: global.alwaysOnlineState,
        antistatusState: global.antistatusState,
        antifakeState: global.antifakeState,
        antibotState: global.antibotState
    };

    try {
        global.autodlState = 'on';
        global.antispamState = 'on';
        global.autobioState = 'on';
        global.alwaysOnlineState = 'on';
        global.antistatusState = { '123@g.us': 'on' };
        global.antifakeState = { '123@g.us': 'on' };
        global.antibotState = { '123@g.us': { status: 'on', action: 'delete' } };
        persistRuntimeSettings();

        global.autodlState = 'off';
        global.antispamState = 'off';
        global.autobioState = 'off';
        global.alwaysOnlineState = 'off';
        global.antistatusState = {};
        global.antifakeState = {};
        global.antibotState = {};
        hydrateRuntimeSettings();

        assert.equal(global.autodlState, 'on');
        assert.equal(global.antispamState, 'on');
        assert.equal(global.autobioState, 'on');
        assert.equal(global.alwaysOnlineState, 'on');
        assert.deepEqual(global.antistatusState, { '123@g.us': 'on' });
        assert.deepEqual(global.antifakeState, { '123@g.us': 'on' });
        assert.deepEqual(global.antibotState, { '123@g.us': { status: 'on', action: 'delete' } });
    } finally {
        if (existed) fs.writeFileSync(statePath, previousFile);
        else { try { fs.unlinkSync(statePath); } catch (_) {} }
        Object.assign(global, previous);
    }
});
