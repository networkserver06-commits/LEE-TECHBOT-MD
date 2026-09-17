'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { MENU_CATEGORIES, getCategory, allCommands } = require('../lib/menuCatalog');

test('IAM upgrade commands appear in dedicated menu categories', () => {
    assert.deepEqual(getCategory('classrep').commands, ['broadcast', 'schedule', 'feedback']);
    assert.deepEqual(getCategory('student').commands, ['todo', 'remind', 'summary']);
    assert.deepEqual(getCategory('dev').commands, ['status', 'deploy', 'logs', 'whois', 'ping', 'dns']);
    const upgrade = ['broadcast', 'schedule', 'feedback', 'todo', 'remind', 'summary', 'status', 'deploy', 'logs'];
    assert.equal(new Set(allCommands()).size, allCommands().length);
    for (const command of upgrade) assert.equal(allCommands().filter((item) => item === command).length, 1);
    assert.ok(MENU_CATEGORIES.some((category) => category.title === 'CLASS REP'));
    assert.ok(MENU_CATEGORIES.some((category) => category.title === 'STUDENT'));
    assert.ok(MENU_CATEGORIES.some((category) => category.title === 'DEVELOPER'));
});
