'use strict';
const fs = require('fs');
const { allCommands } = require('../lib/menuCatalog');
const attached = [...new Set(fs.readFileSync('/home/ubuntu/upload/pasted_content.txt', 'utf8').split('\n').map((line) => line.match(/╾\s+([A-Za-z0-9-]+)/)?.[1]?.toLowerCase()).filter(Boolean))];
const current = new Set(allCommands());
const expected = new Set(attached);
console.log(JSON.stringify({
    attachedCount: attached.length,
    catalogCount: current.size,
    missingFromCatalog: attached.filter((command) => !current.has(command)),
    extraInCatalog: [...current].filter((command) => !expected.has(command))
}, null, 2));
