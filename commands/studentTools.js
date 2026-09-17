'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { configured: grokConfigured, generateGrokCompletion } = require('./groq');
const { configured: aiConfigured, generateChatCompletion } = require('../lib/ai_provider');

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
async function remindCommand(sock, chatId, message, args, context) {
    const reminder = parseReminder(args.join(' '));
    if (!reminder) return reply(sock, chatId, message, 'Usage: `.remind 30 min Submit CAT report` (maximum 30 days)');
    const state = readState();
    const id = `${chatId}:${Date.now()}`;
    const row = { id, chatId, task: reminder.task, dueAt: Date.now() + reminder.delay };
    state.reminders.push(row);
    writeState(state);
    const timer = setTimeout(async () => {
        await sock.sendMessage(chatId, { text: `⏰ *REMINDER*\n${reminder.task}` }).catch(() => null);
        const next = readState();
        next.reminders = next.reminders.filter((item) => item.id !== id);
        writeState(next);
        timers.delete(id);
    }, reminder.delay);
    if (typeof timer.unref === 'function') timer.unref();
    timers.set(id, timer);
    return reply(sock, chatId, message, `✅ Reminder set for *${reminder.label}*: ${reminder.task}`);
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

module.exports = { broadcastCommand, scheduleCommand, feedbackCommand, statusCommand, logsCommand, deployCommand, todoCommand, remindCommand, summaryCommand };
