'use strict';

const fs = require('fs');
const path = require('path');
const { allCommands } = require('../lib/menuCatalog');

const repo = path.join(__dirname, '..');
const attachedPath = process.argv[2] || process.env.ATTACHED_MENU_FILE || '';

function commandsFromAttachedMenu(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return [];
    return fs.readFileSync(filePath, 'utf8')
        .split('\n')
        .map((line) => line.match(/╾\s+([A-Za-z0-9-]+)/)?.[1]?.toLowerCase())
        .filter(Boolean);
}

const attached = commandsFromAttachedMenu(attachedPath);
const catalog = [...new Set(attached.length ? attached : allCommands())];
const source = [
    fs.readFileSync(path.join(repo, 'main.js'), 'utf8'),
    fs.readFileSync(path.join(repo, 'commands', 'menuCompat.js'), 'utf8'),
    fs.readFileSync(path.join(repo, 'lib', 'menuCatalog.js'), 'utf8')
].join('\n');
const handlerNames = new Set(fs.readdirSync(path.join(repo, 'commands'))
    .filter((file) => file.endsWith('.js'))
    .map((file) => file.replace(/\.js$/, '').toLowerCase()));
const explicit = catalog.filter((command) => {
    const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:command|userMessage)\\s*(?:===|startsWith\\()\\s*['"]\\.?${escaped}(?:['"]|\\b)`, 'i').test(source)
        || handlerNames.has(command);
});
const fallback = catalog.filter((command) => !explicit.includes(command));
const hasCatalogFallback = /allCommands\(\)\.includes\(command\)/.test(source);
const unrouted = hasCatalogFallback ? [] : fallback;

console.log(JSON.stringify({
    source: attached.length ? attachedPath : 'lib/menuCatalog.js',
    total: catalog.length,
    explicit: explicit.length,
    fallback,
    routed: catalog.length - unrouted.length,
    unrouted,
    strict: process.argv.includes('--strict')
}, null, 2));

if (unrouted.length && process.argv.includes('--strict')) process.exitCode = 1;
