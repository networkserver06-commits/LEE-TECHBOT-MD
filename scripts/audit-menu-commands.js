'use strict';

const fs = require('fs');
const path = require('path');

const repo = path.join(__dirname, '..');
const attached = fs.readFileSync('/home/ubuntu/upload/pasted_content.txt', 'utf8')
    .split('\n')
    .map((line) => line.match(/╾\s+([A-Za-z0-9-]+)/)?.[1]?.toLowerCase())
    .filter(Boolean);
const unique = [...new Set(attached)];
const source = [
    fs.readFileSync(path.join(repo, 'main.js'), 'utf8'),
    fs.readFileSync(path.join(repo, 'commands', 'menuCompat.js'), 'utf8'),
    fs.readFileSync(path.join(repo, 'lib', 'menuCatalog.js'), 'utf8')
].join('\n');
const handlerNames = new Set(fs.readdirSync(path.join(repo, 'commands'))
    .filter((file) => file.endsWith('.js'))
    .map((file) => file.replace(/\.js$/, '').toLowerCase()));
const explicit = unique.filter((command) => {
    const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:command|userMessage)\\s*(?:===|startsWith\\()\\s*['"]\\.?${escaped}(?:['"]|\\b)`, 'i').test(source)
        || handlerNames.has(command);
});
const missing = unique.filter((command) => !explicit.includes(command));
console.log(JSON.stringify({ total: unique.length, explicit: explicit.length, missing }, null, 2));
