'use strict';

const isOwnerOrSudo = require('./isOwner');
const { resolveGroupTarget } = require('./groupTarget');

function commandArgs(userMessage, command) {
    const text = String(userMessage || '').trim();
    const prefix = String(command || '').trim();
    return text.slice(prefix.length).trim().split(/\s+/).filter(Boolean);
}

function replaceCommandArgs(command, args) {
    return `${command}${args.length ? ` ${args.join(' ')}` : ''}`;
}

async function resolveModerationTarget(sock, options = {}) {
    const {
        chatId,
        message,
        userMessage,
        command,
        isGroup = String(chatId || '').endsWith('@g.us'),
        isOwner = false
    } = options;

    const owner = Boolean(message?.key?.fromMe) || Boolean(isOwner) || await isOwnerOrSudo(
        message?.key?.participant || message?.key?.remoteJid,
        sock,
        chatId
    ).catch(() => false);

    if (isGroup) {
        return {
            ok: true,
            chatId,
            userMessage,
            isGroup: true,
            isRemote: false,
            isOwner: owner,
            isSenderAdmin: options.isSenderAdmin,
            isBotAdmin: options.isBotAdmin
        };
    }

    if (!owner) {
        return {
            ok: false,
            error: '❌ Only the linked bot owner or sudo can configure moderation for a group from private DM.'
        };
    }

    const args = commandArgs(userMessage, command);
    const targetValue = args.shift();
    if (!targetValue) {
        return {
            ok: false,
            error: `❌ Select a group first. Example: ${command} 1 on\nRun .listgroup to see numbered groups.`
        };
    }

    const target = await resolveGroupTarget(sock, chatId, targetValue);
    if (target.error) return { ok: false, error: target.error };

    const participants = Array.isArray(target.participants) ? target.participants : [];
    const identityNumber = (value) => String(value || '').split(':')[0].split('@')[0];
    const linkedIds = new Set([
        identityNumber(sock?.user?.id),
        identityNumber(sock?.user?.jid),
        identityNumber(sock?.user?.lid)
    ].filter(Boolean));
    const botParticipant = participants.find((participant) => {
        const id = identityNumber(participant?.id);
        return linkedIds.has(id);
    });

    return {
        ok: true,
        chatId: target.jid,
        userMessage: replaceCommandArgs(command, args),
        isGroup: true,
        isRemote: true,
        isOwner: true,
        isSenderAdmin: true,
        isBotAdmin: Boolean(botParticipant?.admin),
        target
    };
}

module.exports = { resolveModerationTarget, commandArgs, replaceCommandArgs };
