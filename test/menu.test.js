'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MENU_CATEGORIES, getCategory, allCommands } = require('../lib/menuCatalog');
const help = require('../commands/help');

test('menu catalog contains every requested top-level category', () => {
    assert.deepEqual(
        MENU_CATEGORIES.map((category) => category.key),
        ['settings', 'groups', 'ai', 'anime', 'img-maker', 'convert', 'fun', 'downloads', 'general']
    );
});

test('category aliases resolve to focused menus', () => {
    assert.equal(getCategory('group').key, 'groups');
    assert.equal(getCategory('image').key, 'img-maker');
    assert.equal(getCategory('download').key, 'downloads');
});

test('catalog commands are unique and menu exposes category navigation', () => {
    const commands = allCommands();
    assert.equal(new Set(commands).size, commands.length);
    const menu = help.buildMenu();
    assert.match(menu, /menu <category>/);
    assert.match(menu, /SETTINGS|Settings/);
    assert.match(menu, /DOWNLOADS|Downloads/);
    assert.match(menu, /POWERED BY LEE TECH/);
    assert.match(menu, /OWNER: LEETECH/);
});

test('menu renders live user, mode, speed, and feature status fields', () => {
    const menu = help.buildMenu({
        chatId: '254700000000@s.whatsapp.net',
        message: { key: { remoteJid: '254700000000@s.whatsapp.net' } }
    });
    assert.match(menu, /USER:\* 254700000000/);
    assert.match(menu, /MODE:\* (Public|Private)/);
    assert.match(menu, /SPEED:\* \d+\.\d{4}ms/);
    assert.match(menu, /AUTOREAD:\* (ON|OFF)/);
    assert.match(menu, /AUTOSTATUS:\* (ON|OFF)/);
});
