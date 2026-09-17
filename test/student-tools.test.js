'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { menuCompatCommand } = require('../commands/menuCompat');

const stateFile = path.join(process.cwd(), 'data', 'studentTools.json');
function msg(text) { return { key: { remoteJid: '123@g.us', participant: '111@s.whatsapp.net' }, message: { conversation: text } }; }
function sock(sent) {
    return {
        async groupFetchAllParticipating() {
            return { '555@g.us': { subject: 'IAM Class', participants: [] }, '777@g.us': { subject: 'Project Group', participants: [] } };
        },
        async sendMessage(chatId, payload) { sent.push({ chatId, payload }); }
    };
}
function context(extra = {}) { return { isGroup: true, isSenderAdmin: true, isOwnerOrSudoCheck: true, senderId: '111@s.whatsapp.net', ...extra }; }

function cleanup() { fs.rmSync(stateFile, { force: true }); }

test('student class tools persist schedules, feedback, and todos', async () => {
    cleanup();
    const sent = []; const s = sock(sent);
    await menuCompatCommand(s, '123@g.us', msg('.schedule set Monday 08:00 | CSC 210 - B12'), '.schedule set Monday 08:00 | CSC 210 - B12', context());
    await menuCompatCommand(s, '123@g.us', msg('.feedback HELB application issue'), '.feedback HELB application issue', context({ isSenderAdmin: false, isOwnerOrSudoCheck: false }));
    await menuCompatCommand(s, '123@g.us', msg('.todo add Submit CAT report'), '.todo add Submit CAT report', context());
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    assert.equal(data.schedules['123@g.us'][0].details, 'CSC 210 - B12');
    assert.equal(data.feedback[0].text, 'HELB application issue');
    assert.equal(data.todos['111@s.whatsapp.net'][0].text, 'Submit CAT report');
    assert.match(sent.at(-1).payload.text, /Todo added/i);
    cleanup();
});

test('broadcast and deploy remain permission/webhook guarded', async () => {
    const sent = []; const s = sock(sent);
    await menuCompatCommand(s, '123@g.us', msg('.broadcast CAT moved to Friday'), '.broadcast CAT moved to Friday', context());
    assert.match(sent.at(-1).payload.text, /CLASS ANNOUNCEMENT/);
    await menuCompatCommand(s, '123@s.whatsapp.net', { key: { remoteJid: '123@s.whatsapp.net' }, message: { conversation: '.deploy website' } }, '.deploy website', { isOwnerOrSudoCheck: true });
    assert.match(sent.at(-1).payload.text, /no deployment webhook/i);
});

test('owner DM can schedule a reminder to a numbered group', async () => {
    cleanup();
    const sent = []; const s = sock(sent);
    const dm = { key: { remoteJid: '999@s.whatsapp.net' }, message: { conversation: '.remind group 1 1 min CAT starts soon' } };
    const ownerDm = context({ isGroup: false, isSenderAdmin: false, senderId: '999@s.whatsapp.net' });
    await menuCompatCommand(s, '999@s.whatsapp.net', dm, '.remind group 1 1 min CAT starts soon', ownerDm);
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    assert.equal(data.reminders[0].targetChatId, '555@g.us');
    assert.equal(data.reminders[0].targetName, 'IAM Class');
    assert.match(sent.at(-1).payload.text, /IAM Class/);
    const reminderId = data.reminders[0].id;
    await menuCompatCommand(s, '999@s.whatsapp.net', dm, `.remind cancel ${reminderId}`, ownerDm);
    assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).reminders.length, 0);
    cleanup();
});
