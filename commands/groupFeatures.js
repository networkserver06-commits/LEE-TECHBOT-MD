'use strict';
const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');
const { getGroupMetadata } = require('../lib/groupMetadata');

const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'groupFeatures.json');
const WARNINGS_FILE = path.join(DATA_DIR, 'warnings.json');
const timers = new Map();

function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}
function writeJson(file, value) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
function readState() { return readJson(STATE_FILE, {}); }
function saveState(state) { writeJson(STATE_FILE, state); }
function groupState(state, chatId) { return state[chatId] ||= {}; }
function senderIdOf(message) { return message?.key?.participant || message?.key?.remoteJid; }
function mentionedTarget(message, args = []) {
    const mentioned = message?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned[0]) return mentioned[0];
    const replied = message?.message?.extendedTextMessage?.contextInfo?.participant;
    if (replied) return replied;
    const number = String(args[0] || '').replace(/[^0-9]/g, '');
    return number ? `${number}@s.whatsapp.net` : null;
}
async function requireGroupAdmin(sock, chatId, message, ownerAllowed = true) {
    if (!String(chatId).endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ This command can only be used in a group.' }, { quoted: message });
        return false;
    }
    const senderId = senderIdOf(message);
    const status = await isAdmin(sock, chatId, senderId);
    const owner = Boolean(message?.key?.fromMe) || ownerAllowed && Boolean(message?.isOwnerOrSudoCheck);
    if (!status.metadataAvailable) {
        await sock.sendMessage(chatId, { text: '⏳ Group details are temporarily unavailable or rate-limited. Please try again shortly.' }, { quoted: message });
        return false;
    }
    if (!status.isBotAdmin) {
        await sock.sendMessage(chatId, { text: '❌ The bot must be a group admin first.' }, { quoted: message });
        return false;
    }
    if (!status.isSenderAdmin && !owner) {
        await sock.sendMessage(chatId, { text: '❌ Only group admins can use this command.' }, { quoted: message });
        return false;
    }
    return true;
}
async function unwarnCommand(sock, chatId, message, args = [], context = {}) {
    message.isOwnerOrSudoCheck = context.isOwnerOrSudoCheck;
    if (!await requireGroupAdmin(sock, chatId, message)) return;
    const target = mentionedTarget(message, args);
    if (!target) return sock.sendMessage(chatId, { text: 'Usage: .unwarn @user (or reply to the user)' }, { quoted: message });
    const warnings = readJson(WARNINGS_FILE, {});
    if (!warnings[chatId]?.[target]) return sock.sendMessage(chatId, { text: `ℹ️ @${target.split('@')[0]} has no active warnings.`, mentions: [target] }, { quoted: message });
    const previous = warnings[chatId][target];
    delete warnings[chatId][target];
    if (!Object.keys(warnings[chatId]).length) delete warnings[chatId];
    writeJson(WARNINGS_FILE, warnings);
    await sock.sendMessage(chatId, { text: `✅ Cleared ${previous} warning(s) for @${target.split('@')[0]}.`, mentions: [target] }, { quoted: message });
}
async function addAllCommand(sock, chatId, message, args = [], context = {}) {
    message.isOwnerOrSudoCheck = context.isOwnerOrSudoCheck;
    if (!await requireGroupAdmin(sock, chatId, message)) return;
    const mentioned = message?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const supplied = args.join(' ').split(/[\s,]+/).map((value) => value.replace(/[^0-9]/g, '')).filter(Boolean).map((number) => `${number}@s.whatsapp.net`);
    const targets = [...new Set([...mentioned, ...supplied])].filter((jid) => /@(s\.whatsapp\.net|lid)$/.test(jid));
    if (!targets.length) return sock.sendMessage(chatId, { text: 'Usage: .addall @user1 @user2 or .addall 254700000001 254700000002' }, { quoted: message });
    const added = [], failed = [];
    for (const jid of targets) {
        try {
            await sock.groupParticipantsUpdate(chatId, [jid], 'add');
            added.push(jid);
        } catch (_) { failed.push(jid); }
    }
    const mentions = [...added, ...failed];
    const lines = [`✅ Add-all complete. Added: ${added.length}/${targets.length}.`];
    if (failed.length) lines.push(`⚠️ Could not add: ${failed.map((jid) => `@${jid.split('@')[0]}`).join(', ')}`);
    return sock.sendMessage(chatId, { text: lines.join('\n'), mentions }, { quoted: message });
}
async function toggleFeature(sock, chatId, message, args, key, label, context) {
    message.isOwnerOrSudoCheck = context.isOwnerOrSudoCheck;
    if (!await requireGroupAdmin(sock, chatId, message)) return;
    const value = String(args[0] || 'status').toLowerCase();
    const state = readState();
    const current = Boolean(state[chatId]?.[key]);
    if (value === 'status' || value === 'show') {
        return sock.sendMessage(chatId, { text: `🛡️ *${label}*: ${current ? 'ON ✅' : 'OFF ❌'}\nUsage: .${key} on/off` }, { quoted: message });
    }
    if (!['on', 'off'].includes(value)) return sock.sendMessage(chatId, { text: `Usage: .${key} on/off/status` }, { quoted: message });
    groupState(state, chatId)[key] = value === 'on';
    saveState(state);
    return sock.sendMessage(chatId, { text: `✅ *${label}* turned ${value === 'on' ? '*ON*' : '*OFF*'}.` }, { quoted: message });
}
async function antiStatusCommand(sock, chatId, message, args, context) {
    return toggleFeature(sock, chatId, message, args, 'antistatus', 'Anti-status', context);
}
async function groupAlertCommand(sock, chatId, message, args, context) {
    return toggleFeature(sock, chatId, message, args, 'gcalert', 'Group alerts', context);
}
async function addMetaAiCommand(sock, chatId, message, context) {
    message.isOwnerOrSudoCheck = context.isOwnerOrSudoCheck;
    if (!await requireGroupAdmin(sock, chatId, message)) return;
    const metadata = await getGroupMetadata(sock, chatId);
    if (!metadata) return sock.sendMessage(chatId, { text: '⏳ Group metadata is temporarily unavailable. Please try again shortly.' }, { quoted: message });
    const state = readState();
    groupState(state, chatId).metaAi = {
        enabled: true,
        subject: metadata.subject || 'WhatsApp group',
        description: String(metadata.desc || '').slice(0, 2000),
        memberCount: Array.isArray(metadata.participants) ? metadata.participants.length : 0,
        updatedAt: new Date().toISOString()
    };
    saveState(state);
    await sock.sendMessage(chatId, { text: `✅ Group metadata is now available to the group AI context.\nGroup: *${metadata.subject || 'WhatsApp group'}*\nMembers: ${groupState(state, chatId).metaAi.memberCount}` }, { quoted: message });
}
async function removeMetaAiCommand(sock, chatId, message, context) {
    message.isOwnerOrSudoCheck = context.isOwnerOrSudoCheck;
    if (!await requireGroupAdmin(sock, chatId, message)) return;
    const state = readState();
    if (state[chatId]) delete state[chatId].metaAi;
    saveState(state);
    await sock.sendMessage(chatId, { text: '✅ Group metadata has been removed from the AI context.' }, { quoted: message });
}
function parseTime(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
function parseDuration(args) {
    const amount = Number(args[0]);
    const unit = String(args[1] || 'min').toLowerCase().replace(/s$/, '');
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const multipliers = { min: 60 * 1000, minute: 60 * 1000, hour: 60 * 60 * 1000, day: 24 * 60 * 60 * 1000 };
    if (!multipliers[unit]) return null;
    const milliseconds = amount * multipliers[unit];
    if (milliseconds > 7 * 24 * 60 * 60 * 1000) return null;
    return { milliseconds, label: `${args[0]} ${unit}${amount === 1 ? '' : 's'}` };
}
function scheduleNext(sock, chatId, time, setting, label) {
    const key = `${chatId}:${setting}`;
    if (timers.has(key)) clearTimeout(timers.get(key));
    const [hour, minute] = time.split(':').map(Number);
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const timer = setTimeout(async () => {
        try {
            await sock.groupSettingUpdate(chatId, setting);
            await sock.sendMessage(chatId, { text: `${label} schedule applied automatically at ${time}.` });
        } catch (error) {
            console.error(`[${setting} schedule]`, error?.message || error);
        } finally {
            scheduleNext(sock, chatId, time, setting, label);
        }
    }, Math.max(1000, next.getTime() - now.getTime()));
    if (typeof timer.unref === 'function') timer.unref();
    timers.set(key, timer);
}
function scheduleRelative(sock, chatId, delay, setting, label, stateKey) {
    const key = `${chatId}:${setting}`;
    if (timers.has(key)) clearTimeout(timers.get(key));
    const timer = setTimeout(async () => {
        try {
            await sock.groupSettingUpdate(chatId, setting);
            await sock.sendMessage(chatId, { text: `${label} timer applied automatically.` });
        } catch (error) {
            console.error(`[${setting} timer]`, error?.message || error);
        } finally {
            const state = readState();
            if (state[chatId]) {
                delete state[chatId][stateKey];
                saveState(state);
            }
            timers.delete(key);
        }
    }, Math.max(1000, delay));
    if (typeof timer.unref === 'function') timer.unref();
    timers.set(key, timer);
}
async function timedGroupModeCommand(sock, chatId, message, args, mode, context) {
    message.isOwnerOrSudoCheck = context.isOwnerOrSudoCheck;
    if (!await requireGroupAdmin(sock, chatId, message)) return;
    const key = mode === 'open' ? 'openTime' : 'closeTime';
    const durationKey = `${key}Duration`;
    const value = String(args[0] || '').toLowerCase();
    const state = readState();
    const current = state[chatId]?.[key];
    const currentDuration = state[chatId]?.[durationKey];
    if (!value || value === 'status' || value === 'show') {
        const display = current || (currentDuration ? `in ${currentDuration.label}` : 'not set');
        return sock.sendMessage(chatId, { text: `⏰ *${mode === 'open' ? 'Open' : 'Close'} schedule*: ${display}\nUsage: .${mode === 'open' ? 'opentime' : 'closetime'} HH:MM\nOr relative: .${mode === 'open' ? 'opentime' : 'closetime'} 5 min\nDisable with .${mode === 'open' ? 'opentime' : 'closetime'} off` }, { quoted: message });
    }
    if (value === 'off') {
        if (current || currentDuration) {
            const timerKey = `${chatId}:${mode === 'open' ? 'not_announcement' : 'announcement'}`;
            if (timers.has(timerKey)) clearTimeout(timers.get(timerKey));
            timers.delete(timerKey);
        }
        if (state[chatId]) delete state[chatId][key];
        if (state[chatId]) delete state[chatId][durationKey];
        saveState(state);
        return sock.sendMessage(chatId, { text: `✅ ${mode === 'open' ? 'Open' : 'Close'} schedule disabled.` }, { quoted: message });
    }
    const duration = parseDuration(args);
    if (duration) {
        groupState(state, chatId)[durationKey] = { label: duration.label, expiresAt: Date.now() + duration.milliseconds };
        delete groupState(state, chatId)[key];
        saveState(state);
        const setting = mode === 'open' ? 'not_announcement' : 'announcement';
        scheduleRelative(sock, chatId, duration.milliseconds, setting, mode === 'open' ? 'Open' : 'Close', durationKey);
        return sock.sendMessage(chatId, { text: `✅ ${mode === 'open' ? 'Open' : 'Close'} timer set for *${duration.label}* from now.` }, { quoted: message });
    }
    const parsed = parseTime(args[0]);
    if (!parsed) return sock.sendMessage(chatId, { text: `❌ Use HH:MM or a relative duration, for example .${mode === 'open' ? 'opentime' : 'closetime'} 08:30 or .${mode === 'open' ? 'opentime' : 'closetime'} 5 min` }, { quoted: message });
    groupState(state, chatId)[key] = parsed;
    saveState(state);
    const setting = mode === 'open' ? 'not_announcement' : 'announcement';
    scheduleNext(sock, chatId, parsed, setting, mode === 'open' ? 'Open' : 'Close');
    await sock.sendMessage(chatId, { text: `✅ ${mode === 'open' ? 'Open' : 'Close'} schedule set for *${parsed}* (East Africa Time).` }, { quoted: message });
}
async function openTimeCommand(sock, chatId, message, args, context) { return timedGroupModeCommand(sock, chatId, message, args, 'open', context); }
async function closeTimeCommand(sock, chatId, message, args, context) { return timedGroupModeCommand(sock, chatId, message, args, 'close', context); }
function getMetaAi(chatId) { return readState()[chatId]?.metaAi || null; }
function isGroupAlertEnabled(chatId) { return Boolean(readState()[chatId]?.gcalert); }
module.exports = { addAllCommand, unwarnCommand, antiStatusCommand, groupAlertCommand, addMetaAiCommand, removeMetaAiCommand, openTimeCommand, closeTimeCommand, getMetaAi, isGroupAlertEnabled };
