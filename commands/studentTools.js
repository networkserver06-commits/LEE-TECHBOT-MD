'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { configured: grokConfigured, generateGrokCompletion } = require('./groq');
const { configured: aiConfigured, generateChatCompletion } = require('../lib/ai_provider');
const { fetchParticipatingGroups } = require('../lib/groupTarget');

const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'studentTools.json');
const timers = new Map();
const LOG_ALLOWLIST = {
    app: path.join(process.cwd(), 'logs', 'app.log'),
    nginx: '/var/log/nginx/error.log',
    system: '/var/log/syslog'
};

function readState() {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
    catch (_) { return { schedules: {}, feedback: [], todos: {}, reminders: [] }; }
}
function writeState(state) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}
async function reply(sock, chatId, message, text) {
    return sock.sendMessage(chatId, { text }, { quoted: message });
}
function isAdmin(context) { return Boolean(context.isSenderAdmin || context.isOwnerOrSudoCheck); }
function ownerOnly(context) { return Boolean(context.isOwnerOrSudoCheck); }
function parseTargetAndText(args) {
    const value = args.join(' ').trim();
    const pipe = value.indexOf('|');
    return pipe >= 0 ? { target: value.slice(0, pipe).trim(), text: value.slice(pipe + 1).trim() } : { target: '', text: value };
}

async function broadcastCommand(sock, chatId, message, args, context) {
    if (!context.isGroup || !isAdmin(context)) return reply(sock, chatId, message, '❌ Use `.broadcast` in a class group as an admin.');
    const text = args.join(' ').trim();
    if (!text) return reply(sock, chatId, message, 'Usage: `.broadcast <announcement>`');
    return sock.sendMessage(chatId, { text: `📢 *CLASS ANNOUNCEMENT*\n\n${text}` }, { quoted: message });
}

async function scheduleCommand(sock, chatId, message, args, context) {
    if (!isAdmin(context)) return reply(sock, chatId, message, '❌ Only the class rep or an admin can manage the timetable.');
    const action = String(args[0] || 'list').toLowerCase();
    const state = readState();
    state.schedules[chatId] = state.schedules[chatId] || [];
    if (action === 'set') {
        const value = args.slice(1).join(' ');
        const [slot, ...rest] = value.split('|');
        const [day, time] = String(slot || '').trim().split(/\s+/);
        const details = rest.join('|').trim();
        if (!day || !time || !details) return reply(sock, chatId, message, 'Usage: `.schedule set Monday 08:00 | CSC 210 - Room B12`');
        state.schedules[chatId].push({ day, time, details });
        writeState(state);
        return reply(sock, chatId, message, `✅ Added timetable slot: *${day} ${time}* — ${details}`);
    }
    if (action === 'clear') {
        state.schedules[chatId] = [];
        writeState(state);
        return reply(sock, chatId, message, '✅ Class timetable cleared.');
    }
    const rows = state.schedules[chatId];
    return reply(sock, chatId, message, rows.length ? `🗓️ *CLASS TIMETABLE*\n\n${rows.map((row, i) => `${i + 1}. *${row.day} ${row.time}* — ${row.details}`).join('\n')}` : '🗓️ No timetable entries yet. Use `.schedule set Monday 08:00 | Course - Hall`.');
}

async function feedbackCommand(sock, chatId, message, args, context) {
    const value = args.join(' ').trim();
    const state = readState();
    if (['list', 'all'].includes(value.toLowerCase())) {
        if (!ownerOnly(context)) return reply(sock, chatId, message, '❌ Only the class rep or owner can view feedback.');
        const rows = state.feedback || [];
        return reply(sock, chatId, message, rows.length ? `📝 *FEEDBACK (${rows.length})*\n\n${rows.slice(-20).map((row, i) => `${i + 1}. ${row.text}\n   ${row.createdAt}`).join('\n\n')}` : '📝 No feedback has been submitted.');
    }
    if (!value) return reply(sock, chatId, message, 'Usage: `.feedback <complaint, bursary query, or course issue>`');
    state.feedback = state.feedback || [];
    state.feedback.push({ text: value, createdAt: new Date().toISOString() });
    writeState(state);
    return reply(sock, chatId, message, '✅ Anonymous feedback recorded for the class rep.');
}

async function statusCommand(sock, chatId, message) {
    const free = os.freemem();
    const total = os.totalmem();
    return reply(sock, chatId, message, `🖥️ *BOT STATUS*\nCPU load: ${os.loadavg().map((n) => n.toFixed(2)).join(' / ')}\nRAM: ${Math.round((total - free) / 1024 / 1024)} / ${Math.round(total / 1024 / 1024)} MB used\nUptime: ${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m\nNode: ${process.version}`);
}

async function logsCommand(sock, chatId, message, args, context) {
    if (!ownerOnly(context)) return reply(sock, chatId, message, '❌ Logs are restricted to the owner or sudo.');
    const service = String(args[0] || 'app').toLowerCase();
    const file = LOG_ALLOWLIST[service];
    if (!file) return reply(sock, chatId, message, `Usage: .logs ${Object.keys(LOG_ALLOWLIST).join('|')}`);
    try {
        const text = fs.readFileSync(file, 'utf8').split('\n').slice(-30).join('\n').trim() || '(log is empty)';
        return reply(sock, chatId, message, `📜 *${service.toUpperCase()} LOG TAIL*\n\n${text.slice(-3500)}`);
    } catch (_) { return reply(sock, chatId, message, `❌ Cannot read the ${service} log on this host.`); }
}

async function deployCommand(sock, chatId, message, args, context) {
    if (!ownerOnly(context)) return reply(sock, chatId, message, '❌ Deployment controls are restricted to the owner or sudo.');
    const project = args.join(' ').trim();
    if (!project) return reply(sock, chatId, message, 'Usage: `.deploy <project>`\nConfigure a deployment webhook before triggering builds.');
    return reply(sock, chatId, message, `ℹ️ Deployment request for *${project}* was not sent: no deployment webhook is configured. This guard prevents accidental builds.`);
}

async function todoCommand(sock, chatId, message, args, context) {
    const owner = context.senderId || chatId;
    const action = String(args[0] || 'list').toLowerCase();
    const state = readState();
    state.todos[owner] = state.todos[owner] || [];
    if (action === 'add') {
        const text = args.slice(1).join(' ').trim();
        if (!text) return reply(sock, chatId, message, 'Usage: `.todo add Submit CAT report`');
        state.todos[owner].push({ text, done: false });
        writeState(state);
        return reply(sock, chatId, message, `✅ Todo added: ${text}`);
    }
    if (action === 'done' || action === 'complete') {
        const index = Number(args[1]) - 1;
        if (!Number.isInteger(index) || !state.todos[owner][index]) return reply(sock, chatId, message, 'Usage: `.todo done <number>`');
        state.todos[owner][index].done = true;
        writeState(state);
        return reply(sock, chatId, message, '✅ Todo marked complete.');
    }
    return reply(sock, chatId, message, state.todos[owner].length ? `✅ *TODO LIST*\n\n${state.todos[owner].map((todo, i) => `${i + 1}. ${todo.done ? '☑️' : '⬜'} ${todo.text}`).join('\n')}` : '✅ Todo list is empty. Use `.todo add <task>`');
}

function parseReminder(value) {
    const match = String(value).match(/^(\d+(?:\.\d+)?)\s*(min|mins|minute|minutes|h|hr|hour|hours|d|day|days)\s+(.+)$/i);
    if (!match) return null;
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multiplier = /^m/.test(unit) ? 60000 : /^h/.test(unit) ? 3600000 : 86400000;
    const delay = amount * multiplier;
    if (!Number.isFinite(delay) || delay < 1000 || delay > 30 * 86400000) return null;
    return { delay, task: match[3].trim(), label: `${match[1]} ${match[2]}` };
}

async function resolveReminderTarget(sock, chatId, args, context) {
    if (String(args[0] || '').toLowerCase() !== 'group') return { targetChatId: chatId, args };
    if (!context.isOwnerOrSudoCheck) return { error: '❌ Only the owner or sudo can schedule reminders to a group from a DM.' };
    if (context.isGroup) return { error: '❌ Use group-targeted reminders from your owner DM.' };
    const target = String(args[1] || '').trim();
    if (!target) return { error: 'Usage: `.remind group <number> <time> <task>` or `.remind groups`' };
    const groups = await fetchParticipatingGroups(sock);
    const index = Number(target);
    const group = Number.isInteger(index) && index > 0
        ? groups.find((item) => item.index === index)
        : groups.find((item) => item.jid === target || item.number === target);
    if (!group) return { error: '❌ Group not found. Use `.remind groups` to see the available group numbers.' };
    return { targetChatId: group.jid, args: args.slice(2), groupName: group.subject || group.jid };
}

function scheduleReminder(sock, row) {
    const delay = Math.max(0, row.dueAt - Date.now());
    const timer = setTimeout(async () => {
        await sock.sendMessage(row.targetChatId, { text: `⏰ *REMINDER*\n${row.task}` }).catch(() => null);
        const next = readState();
        next.reminders = (next.reminders || []).filter((item) => item.id !== row.id);
        writeState(next);
        timers.delete(row.id);
    }, delay);
    if (typeof timer.unref === 'function') timer.unref();
    timers.set(row.id, timer);
}

function hydrateReminders(sock) {
    for (const row of (readState().reminders || [])) {
        if (row.dueAt > Date.now() && !timers.has(row.id)) scheduleReminder(sock, row);
    }
}

async function remindCommand(sock, chatId, message, args, context) {
    hydrateReminders(sock);
    if (String(args[0] || '').toLowerCase() === 'groups') {
        if (!context.isOwnerOrSudoCheck || context.isGroup) return reply(sock, chatId, message, '❌ Use `.remind groups` from your owner DM.');
        try {
            const groups = await fetchParticipatingGroups(sock);
            return reply(sock, chatId, message, groups.length
                ? `👥 *REMINDER GROUPS*\n\n${groups.map((group) => `${group.index}. ${group.subject || group.jid}\n   ${group.number}`).join('\n\n')}\n\nUse: .remind group <number> <time> <task>`
                : '❌ No participating groups were found.');
        } catch (error) {
            console.error('[remind groups]', error.message || error);
            return reply(sock, chatId, message, '❌ Could not fetch your groups right now.');
        }
    }
    if (String(args[0] || '').toLowerCase() === 'cancel') {
        const id = args[1];
        const state = readState();
        const row = (state.reminders || []).find((item) => item.id === id && (item.ownerId === (context.senderId || chatId) || context.isOwnerOrSudoCheck));
        if (!row) return reply(sock, chatId, message, '❌ Reminder not found. Use `.remind list` to see active reminders.');
        if (timers.has(id)) clearTimeout(timers.get(id));
        timers.delete(id);
        state.reminders = state.reminders.filter((item) => item.id !== id);
        writeState(state);
        return reply(sock, chatId, message, `✅ Reminder *${id}* cancelled.`);
    }
    if (String(args[0] || '').toLowerCase() === 'list') {
        const ownerId = context.senderId || chatId;
        const rows = (readState().reminders || []).filter((item) => context.isOwnerOrSudoCheck || item.ownerId === ownerId);
        return reply(sock, chatId, message, rows.length ? `⏰ *ACTIVE REMINDERS*\n\n${rows.map((item) => `• ${item.id}\n  ${new Date(item.dueAt).toLocaleString('en-KE')} — ${item.targetName || item.targetChatId}\n  ${item.task}`).join('\n\n')}` : '⏰ No active reminders.');
    }
    let target;
    try { target = await resolveReminderTarget(sock, chatId, args, context); }
    catch (error) { console.error('[remind target]', error.message || error); return reply(sock, chatId, message, '❌ Could not resolve the target group right now.'); }
    if (target.error) return reply(sock, chatId, message, target.error);
    const reminder = parseReminder(target.args.join(' '));
    if (!reminder) return reply(sock, chatId, message, 'Usage: `.remind 30 min Submit CAT report` (maximum 30 days)');
    const state = readState();
    const id = `${chatId}:${Date.now()}`;
    const row = { id, chatId, targetChatId: target.targetChatId, targetName: target.groupName || target.targetChatId, ownerId: context.senderId || chatId, task: reminder.task, dueAt: Date.now() + reminder.delay };
    state.reminders.push(row);
    writeState(state);
    scheduleReminder(sock, row);
    return reply(sock, chatId, message, `✅ Reminder set for *${reminder.label}* to *${row.targetName}*: ${reminder.task}\nID: ${id}`);
}

async function summaryCommand(sock, chatId, message, args) {
    const notes = args.join(' ').trim();
    if (!notes) return reply(sock, chatId, message, 'Usage: `.summary <lecture notes or topic>`');
    try {
        let answer;
        const messages = [
            { role: 'system', content: 'You summarize university lecture notes clearly. Return concise bullet points and key definitions.' },
            { role: 'user', content: notes }
        ];
        if (grokConfigured()) answer = await generateGrokCompletion(messages);
        else if (aiConfigured()) answer = await generateChatCompletion(messages);
        else return reply(sock, chatId, message, '❌ No AI provider is configured for summaries.');
        return reply(sock, chatId, message, `📚 *SUMMARY*\n\n${answer}`);
    } catch (error) {
        console.error('[summary]', error.message || error);
        return reply(sock, chatId, message, '❌ Summary service is currently unavailable.');
    }
}

module.exports = { broadcastCommand, scheduleCommand, feedbackCommand, statusCommand, logsCommand, deployCommand, todoCommand, remindCommand, summaryCommand, hydrateReminders };
