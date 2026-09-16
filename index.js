/**
 * LEE TECH BOT - A WhatsApp Bot
 * Copyright (c) 2024 Professor
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 * 
 * Credits:
 * - Baileys Library by @adiwajshing
 * - Pair Code implementation inspired by TechGod143 & DGXEON
 */
require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
// Using a lightweight persisted store instead of makeInMemoryStore (compat across versions)
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics')
const { rmSync, existsSync } = require('fs')
const { join } = require('path')

// Import lightweight store
const store = require('./lib/lightweight_store')
const { ensureRuntimeDirs, readJson } = require('./lib/runtime')
const { normalizeWhatsAppNumber } = require('./lib/phone')
ensureRuntimeDirs()

// Initialize store
store.readFromFile()
const settings = require('./settings')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)
let reconnectAttempts = 0
let activeSocket = null
let reconnectTimer = null
const connectionNoticePath = path.join(process.env.AUTH_DIR || './session', '.connection-notice.json')
let hasAnnouncedConnection = Boolean(readJson(connectionNoticePath, {}).sent)
const decryptWarningCache = new Map()
const deletedMessageKeys = new Map()
const DELETED_KEY_TTL_MS = 24 * 60 * 60 * 1000

function deletedKey(remoteJid, messageId) {
    return `${remoteJid || ''}:${messageId || ''}`
}

function rememberDeletedMessage(remoteJid, messageId) {
    if (!remoteJid || !messageId) return
    const now = Date.now()
    deletedMessageKeys.set(deletedKey(remoteJid, messageId), now)
    for (const [key, timestamp] of deletedMessageKeys) {
        if (now - timestamp > DELETED_KEY_TTL_MS) deletedMessageKeys.delete(key)
    }
}

function wasDeletedMessage(remoteJid, messageId) {
    const timestamp = deletedMessageKeys.get(deletedKey(remoteJid, messageId))
    return Boolean(timestamp && Date.now() - timestamp <= DELETED_KEY_TTL_MS)
}

function isSignalDecryptError(error) {
    const text = String(error?.stack || error?.message || error || '').toLowerCase()
    return /bad mac|verif(?:y|ication)mac|failed to decrypt|decrypt.*session|known session|signal.*session|waiting for this message/.test(text)
}

function logDecryptWarningOnce(messageId, error) {
    const key = messageId || 'unknown'
    const now = Date.now()
    const previous = decryptWarningCache.get(key) || 0
    if (now - previous < 60000) return
    decryptWarningCache.set(key, now)
    if (decryptWarningCache.size > 1000) {
        for (const [id, timestamp] of decryptWarningCache) {
            if (now - timestamp > 60000) decryptWarningCache.delete(id)
        }
    }
    console.warn(`[crypto] message skipped because Signal could not decrypt it${error?.message ? `: ${error.message}` : ''}`)
}

// Memory optimization - Force garbage collection if available
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000) // every 1 minute

// Memory monitoring - Restart if RAM gets too high
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 400) {
        console.log('⚠️ RAM too high (>400MB), restarting bot...')
        process.exit(1) // Panel will auto-restart
    }
}, 30_000) // check every 30 seconds

let phoneNumber = normalizeWhatsAppNumber(process.env.PHONE_NUMBER || '')
let owner = readJson('./data/owner.json', { owner: settings.ownerNumber || '' })

global.botname = "LEE TECH BOT"
global.themeemoji = "•"
// A saved session reconnects silently. New sessions use linking-code login by
// default and ask directly for the phone number. Set AUTH_METHOD=qr or
// PAIRING_CODE=false only when QR login is explicitly preferred.
let pairingCode = process.env.AUTH_METHOD !== 'qr' && process.env.PAIRING_CODE !== 'false' || process.argv.includes("--pairing-code")
const useMobile = process.env.USE_MOBILE === 'true' || process.argv.includes("--mobile")
const authDir = process.env.AUTH_DIR || './session'

// Katabump consoles can expose stdin without reporting a TTY, so keep the
// prompt available in both terminal and panel-console deployments.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY })
const question = (text) => {
    if (rl && !rl.closed) {
        return new Promise((resolve) => rl.question(text, resolve))
    }
    const error = new Error('Pairing input console is closed')
    error.code = 'PAIRING_INPUT_CLOSED'
    return Promise.reject(error)
}


async function startXeonBotInc() {
    try {
        let { version, isLatest } = await fetchLatestBaileysVersion()
        // Auth files are generated automatically on first pairing. They do not
        // need to be uploaded beforehand; keep AUTH_DIR on persistent panel
        // storage if you want to avoid relinking after a restart.
        const { state, saveCreds } = await useMultiFileAuthState(authDir)
        const msgRetryCounterCache = new NodeCache()

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid)
                // Never give Baileys the original payload for a message that
                // WhatsApp has revoked; doing so can make an old bot text be
                // retried and appear again after it was deleted.
                if (wasDeletedMessage(jid, key.id)) return undefined
                let msg = await store.loadMessage(jid, key.id)
                return msg?.message || undefined
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        })
        activeSocket = XeonBotInc

        // Save credentials when they update
        XeonBotInc.ev.on('creds.update', saveCreds)

    store.bind(XeonBotInc.ev)

    // Message handling
    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        try {
            const mek = chatUpdate.messages[0]
            if (!mek.message) return
            const protocol = mek.message.protocolMessage
            if (protocol?.type === 0 && protocol.key?.id) {
                rememberDeletedMessage(protocol.key.remoteJid || mek.key?.remoteJid, protocol.key.id)
            }
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                await handleStatus(XeonBotInc, chatUpdate);
                return;
            }
            // In private mode, only block non-group messages (allow groups for moderation)
            // Note: XeonBotInc.public is not synced, so we check mode in main.js instead
            // This check is kept for backward compatibility but mainly blocks DMs
            if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                const isGroup = mek.key?.remoteJid?.endsWith('@g.us')
                if (!isGroup) return // Block DMs in private mode, but allow group messages
            }
            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return

            // Clear message retry cache to prevent memory bloat
            if (XeonBotInc?.msgRetryCounterCache) {
                XeonBotInc.msgRetryCounterCache.clear()
            }

            try {
                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                if (isSignalDecryptError(err)) {
                    logDecryptWarningOnce(mek.key?.id, err)
                    return
                }
                console.error("Error in handleMessages:", err)
                // Only try to send error message if we have a valid chatId
                if (mek.key && mek.key.remoteJid) {
                    await XeonBotInc.sendMessage(mek.key.remoteJid, {
                        text: '❌ An error occurred while processing your message.',
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363404186001130@newsletter',
                                newsletterName: 'LEE TECHBot MD',
                                serverMessageId: -1
                            }
                        }
                    }).catch(console.error);
                }
            }
        } catch (err) {
            console.error("Error in messages.upsert:", err)
        }
    })

    // Add these event handlers for better functionality
    XeonBotInc.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    XeonBotInc.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = XeonBotInc.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
        }
    })

    XeonBotInc.getName = (jid, withoutContact = false) => {
        id = XeonBotInc.decodeJid(jid)
        withoutContact = XeonBotInc.withoutContact || withoutContact
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === XeonBotInc.decodeJid(XeonBotInc.user.id) ?
            XeonBotInc.user :
            (store.contacts[id] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }

    XeonBotInc.public = true

    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

    // Handle pairing code. The phone number is collected before the socket
    // reaches its connecting state, but the request itself must wait until
    // the socket is initializing; requesting too early causes Baileys 428
    // "Connection Closed / Precondition Required" responses.
    let requestedPhoneNumber = ''
    let pairingRequestStarted = false
    if (pairingCode && !XeonBotInc.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api')

        // Re-read panel variables here because some panel launchers inject
        // environment values after the module bootstrap phase.
        const explicitPairingVariables = ['PHONE_NUMBER', 'PAIRING_NUMBER', 'PAIRING_PHONE', 'WHATSAPP_NUMBER', 'WHATSAPP_PHONE', 'WA_NUMBER', 'BOT_PHONE_NUMBER', 'OWNER_NUMBER']
        const envPairingEntry = Object.entries(process.env).find(([key, value]) => {
            if (!value || !/PHONE|WHATSAPP|PAIR|WA_NUMBER|BOT_NUMBER|OWNER_NUMBER|^NUMBER$/i.test(key)) return false
            return Boolean(normalizeWhatsAppNumber(value))
        })
        const pairingEntry = explicitPairingVariables.map((key) => [key, process.env[key]])
            .concat(envPairingEntry ? [envPairingEntry] : [])
            .find(([, value]) => Boolean(normalizeWhatsAppNumber(value)))
        const configuredPairingInput = pairingEntry?.[1] || (process.env.PAIRING_CODE !== 'true' && process.env.PAIRING_CODE !== 'false' ? process.env.PAIRING_CODE : '') || phoneNumber
        requestedPhoneNumber = normalizeWhatsAppNumber(configuredPairingInput)
        const detectedFrom = pairingEntry?.[0] || (requestedPhoneNumber ? 'bootstrap' : 'none')
        console.log(chalk.cyan(`Pairing configuration: number ${requestedPhoneNumber ? 'detected' : 'missing'} (${detectedFrom}), console input ${rl.closed || process.stdin.readableEnded ? 'closed' : 'available'}`))
        do {
            if (!requestedPhoneNumber && (rl.closed || process.stdin.readableEnded)) {
                throw Object.assign(new Error('Pairing input console is closed and no valid pairing number was detected'), { code: 'PAIRING_INPUT_CLOSED' })
            }
            if (!requestedPhoneNumber) requestedPhoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Enter WhatsApp phone number for pairing code:\nInclude country code digits, without +, spaces, or dashes.\nExample: 254116553618 or 254723456789\nNumber: `)))
            requestedPhoneNumber = normalizeWhatsAppNumber(requestedPhoneNumber)
            if (!requestedPhoneNumber) {
                console.log(chalk.red('Please enter the complete international number, for example 254781231617 or +254 781 231 617. Try again.'))
                requestedPhoneNumber = ''
            }
        } while (!requestedPhoneNumber)
    }

    // Connection handling
    XeonBotInc.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect, qr } = s

        // A previous socket can emit delayed events during an update or
        // reconnect handoff. Never let those events print a second banner or
        // start another lifecycle action.
        if (activeSocket !== XeonBotInc) return
        
        if (qr) {
            if (!pairingCode) console.log(chalk.yellow('📱 QR Code generated. Please scan with WhatsApp.'))
        }
        
        if (connection === 'connecting') {
            if (XeonBotInc.__connectingLogged) return
            XeonBotInc.__connectingLogged = true
            console.log(chalk.yellow('🔄 Connecting to WhatsApp...'))
            if (pairingCode && requestedPhoneNumber && !pairingRequestStarted) {
                pairingRequestStarted = true
                setTimeout(async () => {
                    for (let attempt = 1; attempt <= 3; attempt += 1) {
                        if (activeSocket !== XeonBotInc || XeonBotInc.authState.creds.registered) return
                        try {
                            console.log(chalk.cyan(`Requesting WhatsApp pairing code for ${requestedPhoneNumber} (attempt ${attempt}/3)...`))
                            let code = await XeonBotInc.requestPairingCode(requestedPhoneNumber)
                            code = code?.match(/.{1,4}/g)?.join('-') || code
                            console.log(chalk.black(chalk.bgGreen('Your Pairing Code : ')), chalk.black(chalk.white(code)))
                            console.log(chalk.yellow(`\nPlease enter this code in your WhatsApp app:\n1. Open WhatsApp\n2. Go to Settings > Linked Devices\n3. Tap \`Link a Device\`\n4. Enter the code shown above`))
                            return
                        } catch (error) {
                            const statusCode = error?.output?.statusCode || error?.statusCode
                            const transient = statusCode === 428 || /connection closed|precondition required/i.test(String(error?.message || error))
                            if (!transient || attempt === 3) {
                                console.error('Error requesting pairing code:', error)
                                console.log(chalk.red('Failed to get pairing code. Keep the panel running and try again.'))
                                return
                            }
                            await delay(2000)
                        }
                    }
                }, 1500)
            }
        }
        
        if (connection == "open") {
            if (XeonBotInc.__connectionOpened) return
            XeonBotInc.__connectionOpened = true
            if (reconnectTimer) {
                clearTimeout(reconnectTimer)
                reconnectTimer = null
            }
            reconnectAttempts = 0
            console.log(chalk.magenta(` `))
            console.log(chalk.yellow(`🌿Connected to => ` + JSON.stringify(XeonBotInc.user, null, 2)))

            if (!hasAnnouncedConnection) {
                hasAnnouncedConnection = true
                try {
                    const botNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
                    await XeonBotInc.sendMessage(botNumber, {
                        text: `🤖 Bot connected successfully for the first time in this run.\n\n⏰ Time: ${new Date().toLocaleString()}\n✅ Status: Online and ready!`,
                    });
                    fs.mkdirSync(path.dirname(connectionNoticePath), { recursive: true })
                    fs.writeFileSync(connectionNoticePath, JSON.stringify({ sent: true, sentAt: new Date().toISOString() }))
                } catch (error) {
                    console.error('Error sending initial connection message:', error.message)
                }
            }

            await delay(1999)
            console.log(chalk.yellow(`\n\n                  ${chalk.bold.blue(`[ ${global.botname || 'LEE TECH BOT'} ]`)}\n\n`))
            console.log(chalk.cyan(`< ================================================== >`))
            console.log(chalk.magenta(`\n${global.themeemoji || '•'} YT CHANNEL: Network Server`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} GITHUB: networkserver06-commits`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} WA NUMBER: ${owner}`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} CREDIT: LEE TECH`))
            console.log(chalk.green(`${global.themeemoji || '•'} 🤖 Bot Connected Successfully! ✅`))
            console.log(chalk.blue(`Bot Version: ${settings.version}`))
        }
        
        if (connection === 'close') {
            if (activeSocket !== XeonBotInc) {
                console.log(chalk.yellow('Ignoring close event from a stale WhatsApp socket.'))
                return
            }
            activeSocket = null
            if (global.__updateRestarting) {
                console.log(chalk.yellow('Update restart requested; suppressing reconnect for the closing socket.'))
                return
            }
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
            const statusCode = lastDisconnect?.error?.output?.statusCode
            const disconnectText = String(lastDisconnect?.error?.message || lastDisconnect?.error || '')
            const isStreamConflict = statusCode === 440 || /stream errored.*conflict|conflict.*stream errored/i.test(disconnectText)

            if (isStreamConflict) {
                global.__conflictRestarting = true
                console.error(chalk.red('WhatsApp stream conflict detected; stopping this process so the host can start one clean instance.'))
                try {
                    if (XeonBotInc?.ws && typeof XeonBotInc.ws.close === 'function') XeonBotInc.ws.close()
                } catch (_) {}
                setTimeout(() => process.exit(1), 1500)
                return
            }
            
            console.log(chalk.red(`Connection closed due to ${lastDisconnect?.error}, reconnecting ${shouldReconnect}`))
            
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                try {
                    rmSync(authDir, { recursive: true, force: true })
                    console.log(chalk.yellow(`Auth directory deleted: ${authDir}. Please re-authenticate.`))
                } catch (error) {
                    console.error('Error deleting session:', error)
                }
                console.log(chalk.red('Session logged out. Please re-authenticate.'))
            }
            
            if (shouldReconnect) {
                if (reconnectTimer) return
                reconnectAttempts += 1
                const backoffMs = Math.min(60000, 5000 * (2 ** Math.min(reconnectAttempts - 1, 4)))
                console.log(chalk.yellow(`Reconnecting in ${Math.ceil(backoffMs / 1000)}s (attempt ${reconnectAttempts})...`))
                reconnectTimer = setTimeout(async () => {
                    reconnectTimer = null
                    if (global.__updateRestarting || activeSocket) return
                    await startXeonBotInc()
                }, backoffMs)
            }
        }
    })

    // Track recently-notified callers to avoid spamming messages
    const antiCallNotified = new Set();

    // Anticall handler: block callers when enabled
    XeonBotInc.ev.on('call', async (calls) => {
        try {
            const { readState: readAnticallState } = require('./commands/anticall');
            const state = readAnticallState();
            if (!state.enabled) return;
            for (const call of calls) {
                const callerJid = call.from || call.peerJid || call.chatId;
                if (!callerJid) continue;
                try {
                    // First: attempt to reject the call if supported
                    try {
                        if (typeof XeonBotInc.rejectCall === 'function' && call.id) {
                            await XeonBotInc.rejectCall(call.id, callerJid);
                        } else if (typeof XeonBotInc.sendCallOfferAck === 'function' && call.id) {
                            await XeonBotInc.sendCallOfferAck(call.id, callerJid, 'reject');
                        }
                    } catch {}

                    // Notify the caller only once within a short window
                    if (!antiCallNotified.has(callerJid)) {
                        antiCallNotified.add(callerJid);
                        setTimeout(() => antiCallNotified.delete(callerJid), 60000);
                        await XeonBotInc.sendMessage(callerJid, { text: '📵 Anticall is enabled. Your call was rejected and you will be blocked.' });
                    }
                } catch {}
                // Then: block after a short delay to ensure rejection and message are processed
                setTimeout(async () => {
                    try { await XeonBotInc.updateBlockStatus(callerJid, 'block'); } catch {}
                }, 800);
            }
        } catch (e) {
            // ignore
        }
    });

    XeonBotInc.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantUpdate(XeonBotInc, update);
    });

    XeonBotInc.ev.on('messages.upsert', async (m) => {
        if (m.messages[0].key && m.messages[0].key.remoteJid === 'status@broadcast') {
            await handleStatus(XeonBotInc, m);
        }
    });

    XeonBotInc.ev.on('status.update', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    XeonBotInc.ev.on('messages.reaction', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    return XeonBotInc
    } catch (error) {
        if (error?.code === 'PAIRING_INPUT_CLOSED' || error?.code === 'ERR_USE_AFTER_CLOSE') {
            console.error('Pairing input closed before a number was entered. Enable the Katabump console/terminal input and restart the server.')
            process.exitCode = 1
            return
        }
        console.error('Error in startXeonBotInc:', error)
        await delay(5000)
        startXeonBotInc()
    }
}


// Start the bot with error handling
startXeonBotInc().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
})

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err)
})

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`Update ${__filename}`))
    delete require.cache[file]
    require(file)
})
