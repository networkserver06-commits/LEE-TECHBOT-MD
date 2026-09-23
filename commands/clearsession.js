'use strict';

const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const channelInfo = {
    contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363404186001130@newsletter',
            newsletterName: 'LEE TECHBot MD',
            serverMessageId: -1
        }
    }
};

function sessionDirectory() {
    return path.resolve(process.env.AUTH_DIR || path.join(__dirname, '../session'));
}

function isLiveRegisteredSocket(sock) {
    return Boolean(sock?.user?.id && sock?.authState?.creds?.registered !== false);
}

async function clearSessionCommand(sock, chatId, msg) {
    try {
        const senderId = msg.key.participant || msg.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!msg.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, {
                text: '❌ This command can only be used by the owner!',
                ...channelInfo
            });
            return;
        }

        const sessionDir = sessionDirectory();
        if (!fs.existsSync(sessionDir)) {
            await sock.sendMessage(chatId, {
                text: `❌ Auth directory not found: ${sessionDir}`,
                ...channelInfo
            });
            return;
        }

        // Never delete Signal keys from a live socket. Removing pre-keys,
        // sender keys, or app-state keys during a connection corrupts the
        // active crypto state and causes WhatsApp to show "Waiting for this
        // message" for new messages.
        if (isLiveRegisteredSocket(sock)) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Session cleanup was stopped safely. The bot is currently connected, so deleting Signal keys would cause “Waiting for this message” errors.\n\nRestart the bot first, then run .clearsession only if you intend to re-pair. Existing messages cannot be decrypted retroactively.',
                ...channelInfo
            });
            return;
        }

        const files = fs.readdirSync(sessionDir, { withFileTypes: true });
        const removable = files.filter((entry) =>
            entry.isFile() && (/\.tmp$|\.bak$|\.lock$/.test(entry.name) || entry.name === '.connection-notice.json')
        );
        let filesCleared = 0;
        let errors = 0;
        for (const entry of removable) {
            try {
                fs.unlinkSync(path.join(sessionDir, entry.name));
                filesCleared++;
            } catch (_) {
                errors++;
            }
        }

        await sock.sendMessage(chatId, {
            text: `✅ Safe session cleanup completed.\n\n• Temporary files removed: ${filesCleared}\n• Errors: ${errors}\n• Signal keys preserved: yes\n\nThe bot must be re-paired only when WhatsApp has logged the device out.`,
            ...channelInfo
        });
    } catch (error) {
        console.error('Error in clearsession command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to inspect session safely!',
            ...channelInfo
        });
    }
}

module.exports = clearSessionCommand;
module.exports.sessionDirectory = sessionDirectory;
module.exports.isLiveRegisteredSocket = isLiveRegisteredSocket;
