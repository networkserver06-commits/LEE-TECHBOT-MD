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
const { restoreSessionBundle } = require('./lib/sessionBundle')
const selfChatModule = require('./lib/selfChat')
const { selfChatSendOptions, isSelfChat, createSelfChatSendQueue } = selfChatModule
const enqueueSelfChatSend = typeof createSelfChatSendQueue === 'function'
    ? createSelfChatSendQueue()
    : (jid, send) => send()
const persistMessage = typeof selfChatModule.persistMessage === 'function'
    ? selfChatModule.persistMessage
    : (store, message, maxMessages = 20) => {
        const jid = String(message?.key?.remoteJid || '').trim()
        const id = String(message?.key?.id || '')
        if (!store || !jid || !id) return false
        if (!store.messages || typeof store.messages !== 'object') store.messages = {}
        const bucket = Array.isArray(store.messages[jid]) ? store.messages[jid] : []
        const existing = bucket.findIndex(item => String(item?.key?.id || '') === id)
        if (existing >= 0) bucket[existing] = message
        else bucket.push(message)
        store.messages[jid] = bucket.slice(-Math.max(1, Number(maxMessages) || 20))
        store.dirty = true
        return true
    }
ensureRuntimeDirs()

// Initialize store
store.readFromFile()
const settings = require('./settings')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)
let reconnectAttempts = 0
let streamRestartAttempts = 0
let ackStreamAttempts = 0
let activeSocket = null
let reconnectTimer = null
let socketStartInFlight = false
let selfChatWarmupUntil = 0
let cachedBaileysVersion = null
const connectionNoticePath = path.join(process.env.AUTH_DIR || './session', '.connection-notice.json')
let hasAnnouncedConnection = Boolean(readJson(connectionNoticePath, {}).sent)
const pendingRestartNoticePath = path.join(process.cwd(), 'data', '.pending-restart-notice.json')
let pendingRestartNotice = readJson(pendingRestartNoticePath, {})
const decryptWarningCache = new Map()
const signalDecryptFailures = []
let signalRecoveryScheduled = false
let signalConsoleIntercepting = false
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
    return /bad mac|verif(?:y|ication)mac|failed to decrypt|decrypt.*session|known session|signal.*session|waiting for this message|over\s+\d+\s+messages?\s+into\s+the\s+future/.test(text)
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

function scheduleSignalSessionRecovery(error) {
    const now = Date.now()
    signalDecryptFailures.push(now)
    while (signalDecryptFailures[0] && now - signalDecryptFailures[0] > 60000) signalDecryptFailures.shift()
    if (signalRecoveryScheduled || signalDecryptFailures.length < 3) return
    if (process.env.SESSION_RECOVERY_RESET !== 'true') {
        signalRecoveryScheduled = true
        console.warn('[crypto] Repeated Signal decryption failures detected; preserving the paired auth session. Messages that cannot be decrypted will be skipped.')
        return
    }
    signalRecoveryScheduled = true
    // When npm start is using the recovery supervisor, let the supervisor
    // rotate the auth directory. This prevents two processes from renaming
    // the same folder at the same time.
    if (process.env.SESSION_RECOVERY_USED !== undefined) return
    console.error(`[crypto] Repeated Signal decryption errors detected. Backing up the broken session and restarting for a fresh pairing.`)
    try {
        const resolvedAuthDir = path.resolve(authDir)
        const backupDir = `${resolvedAuthDir}.bad-mac-${new Date().toISOString().replace(/[:.]/g, '-')}`
        if (fs.existsSync(resolvedAuthDir)) {
            fs.renameSync(resolvedAuthDir, backupDir)
            fs.mkdirSync(resolvedAuthDir, { recursive: true, mode: 0o700 })
        console.error(`[crypto] Broken auth folder moved to ${backupDir}. Starting a fresh pairing socket.`)
        }
    } catch (resetError) {
        console.error(`[crypto] Could not reset the broken auth folder: ${resetError.message || resetError}`)
    }
    const brokenSocket = activeSocket
    activeSocket = null
    try {
        if (brokenSocket?.ws && typeof brokenSocket.ws.close === 'function') brokenSocket.ws.close()
    } catch (_) {}
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null
        if (global.__updateRestarting || activeSocket) return
        await startXeonBotInc()
    }, 3000)
    reconnectTimer.unref?.()
}

// libsignal can catch decryption failures inside its queue and print them
// directly instead of rejecting the Baileys message event. Intercept only
// known Signal failures so a stale session is recovered even when the panel
// launches `node index.js` directly rather than through the recovery wrapper.
const originalConsoleError = console.error.bind(console)
console.error = (...args) => {
    const text = args.map((value) => value instanceof Error ? value.stack || value.message : String(value)).join(' ')
    const signalError = isSignalDecryptError(text)
    if (signalError && signalRecoveryScheduled) return
    originalConsoleError(...args)
    if (signalConsoleIntercepting || !signalError) return
    signalConsoleIntercepting = true
    try { scheduleSignalSessionRecovery(new Error(text)) }
    finally { signalConsoleIntercepting = false }
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

let owner = readJson('./data/owner.json', { owner: settings.ownerNumber || '' })

global.botname = "LEE TECH BOT"
global.themeemoji = "•"
const authDir = process.env.AUTH_DIR || './session'

let sessionBundle = process.env.SESSION_BUNDLE || process.env.SESSION_ID || ''
if (sessionBundle) {
    try {
        const imported = restoreSessionBundle(sessionBundle, authDir)
        console.log(`[auth] SESSION_BUNDLE ${imported.imported ? `imported (${imported.files} files)` : imported.reason}.`)
    } catch (error) {
        console.error(`[auth] SESSION_BUNDLE could not be imported: ${error.message || error}`)
    }
}

// Katabump consoles can expose stdin without reporting a TTY, so keep the
// prompt available in both terminal and panel-console deployments.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY })
const question = (text) => {
    if (rl && !rl.closed) {
        return new Promise((resolve) => rl.question(text, resolve))
    }
    const error = new Error('Pairing input console is closed')
    error.code = 'SESSION_INPUT_CLOSED'
    return Promise.reject(error)
}


async function startXeonBotInc() {
    if (activeSocket || socketStartInFlight || global.__updateRestarting) return activeSocket
    socketStartInFlight = true
    try {
        // Reuse the negotiated version across reconnects. Fetching a different
        // latest version during every handoff can create avoidable protocol
        // churn and is slower on panel hosts.
        if (!cachedBaileysVersion) cachedBaileysVersion = await fetchLatestBaileysVersion()
        const { version } = cachedBaileysVersion
        // The bot never creates a new WhatsApp link from this process. Supply
        // SESSION_BUNDLE/SESSION_ID in the environment, or paste the bundle
        // into the host terminal when prompted.
        let { state, saveCreds } = await useMultiFileAuthState(authDir)
        if (!state.creds.registered && !sessionBundle) {
            const promptEnabled = process.env.SESSION_TERMINAL_PROMPT === 'true'
                || (process.stdin.isTTY && process.env.SESSION_TERMINAL_PROMPT !== 'false')
            if (!promptEnabled) {
                const error = new Error('No registered WhatsApp session. Set SESSION_BUNDLE in the environment or enable SESSION_TERMINAL_PROMPT=true and paste it in the host terminal.')
                error.code = 'NO_SESSION_CONFIGURED'
                throw error
            }
            const pasted = await question(chalk.bgBlack(chalk.greenBright('Paste SESSION_BUNDLE (or SESSION_ID) and press Enter:\n')))
            if (!String(pasted || '').trim()) {
                const error = new Error('No session bundle was pasted. Add SESSION_BUNDLE to the environment and restart.')
                error.code = 'NO_SESSION_CONFIGURED'
                throw error
            }
            sessionBundle = String(pasted).trim()
            restoreSessionBundle(sessionBundle, authDir)
            ;({ state, saveCreds } = await useMultiFileAuthState(authDir))
        }
        if (!state.creds.registered) {
            const error = new Error('The configured session is not registered. Generate a new SESSION_BUNDLE from the separate pairing site.')
            error.code = 'NO_SESSION_CONFIGURED'
            throw error
        }
        const msgRetryCounterCache = new NodeCache()

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            // Keep outgoing messages flowing through messages.upsert so the
            // retry callback can return their original plaintext to WhatsApp.
            emitOwnEvents: true,
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
            keepAliveIntervalMs: Number(process.env.WA_KEEPALIVE_MS || 10000),
        })
        activeSocket = XeonBotInc

        // WhatsApp can leave replies to the linked bot account's own chat
        // showing "Waiting for this message" when the retry callback cannot
        // find the original self-chat message. Normalize self-chat JIDs,
        // remove the unsafe optional quote, and persist the returned outgoing
        // message as a final guarantee even if emitOwnEvents is delayed.
        const rawSendMessage = XeonBotInc.sendMessage.bind(XeonBotInc)
        XeonBotInc.sendMessage = async (jid, content, options = {}) => {
            const prepared = selfChatSendOptions(XeonBotInc, jid, options)
            const send = async () => {
                const sent = await rawSendMessage(prepared.jid, content, prepared.options)
                persistMessage(store, sent, settings.maxStoreMessages)
                return sent
            }
            if (!isSelfChat(XeonBotInc, jid)) return send()
            const warmupDelay = Math.max(250, selfChatWarmupUntil - Date.now())
            return enqueueSelfChatSend(prepared.jid, send, warmupDelay)
        }

        // Persist every pairing and key update. Keep the listener guarded so a
        // storage failure is visible without becoming an unhandled rejection
        // that can restart the bot after an otherwise successful pairing.
        XeonBotInc.ev.on('creds.update', async (update) => {
            try {
                await saveCreds(update)
            } catch (error) {
                console.error(`[auth] Could not persist WhatsApp session: ${error.message || error}`)
            }
        })

    store.bind(XeonBotInc.ev)

    // Message handling
    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        try {
            const mek = chatUpdate.messages[0]
            if (!mek.message) return
            // Do not process encrypted updates while Baileys is still opening
            // or handing off a reconnecting socket. Processing them too early
            // can create duplicate replies and WhatsApp's "waiting for this
            // message" placeholders while Signal sessions catch up.
            if (!XeonBotInc.__connectionOpened || activeSocket !== XeonBotInc) return
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

            try {
                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                if (isSignalDecryptError(err)) {
                    logDecryptWarningOnce(mek.key?.id, err)
                    scheduleSignalSessionRecovery(err)
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
            if (isSignalDecryptError(err)) {
                logDecryptWarningOnce(chatUpdate?.messages?.[0]?.key?.id, err)
                scheduleSignalSessionRecovery(err)
                return
            }
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

    // Connection handling
    XeonBotInc.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect } = s

        // A previous socket can emit delayed events during an update or
        // reconnect handoff. Never let those events print a second banner or
        // start another lifecycle action.
        if (activeSocket !== XeonBotInc) return
        
        if (connection === 'connecting') {
            if (XeonBotInc.__connectingLogged) return
            XeonBotInc.__connectingLogged = true
            console.log(chalk.yellow('🔄 Connecting to WhatsApp...'))
        }
        
        if (connection === "open") {
            if (XeonBotInc.__connectionOpened) return
            XeonBotInc.__connectionOpened = true
            // WhatsApp may report the WebSocket open before the own PN/LID
            // Signal sessions are usable. Delay only self-chat sends so the
            // first post-restart owner reply is not rendered as a retry
            // placeholder; groups and ordinary DMs remain immediate.
            selfChatWarmupUntil = Date.now() + 5000
            signalRecoveryScheduled = false
            signalDecryptFailures.length = 0
            if (reconnectTimer) {
                clearTimeout(reconnectTimer)
                reconnectTimer = null
            }
            reconnectAttempts = 0
            streamRestartAttempts = 0
            ackStreamAttempts = 0
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

            if (pendingRestartNotice?.targetJid) {
                const notice = pendingRestartNotice
                try {
                    await XeonBotInc.sendMessage(notice.targetJid, {
                        text: `✅ *Bot updated and restarted successfully*\nVersion: *${notice.version || settings.version}*\nRevision: *${notice.revision || 'archive'}*\nStatus: Online and ready.`
                    })
                    rmSync(pendingRestartNoticePath, { force: true })
                    pendingRestartNotice = {}
                } catch (error) {
                    console.error('Error sending post-restart update notice:', error.message || error)
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
            XeonBotInc.__connectionOpened = false
            activeSocket = null
            if (global.__updateRestarting) {
                console.log(chalk.yellow('Update restart requested; suppressing reconnect for the closing socket.'))
                return
            }
            const statusCode = lastDisconnect?.error?.output?.statusCode
            const disconnectText = String(lastDisconnect?.error?.message || lastDisconnect?.error || '')
            const needsFreshPairing = statusCode === DisconnectReason.loggedOut || statusCode === 401
            const shouldReconnect = !needsFreshPairing && !global.__updateRestarting
            const isStreamConflict = statusCode === 440 || /stream errored.*conflict|conflict.*stream errored/i.test(disconnectText)
            const isRestartRequired = statusCode === DisconnectReason.restartRequired || /stream errored.*restart required|restart required/i.test(disconnectText)
            const isAckStreamError = /stream errored.*\back\b|\back\b.*stream errored/i.test(disconnectText)

            if (isStreamConflict) {
                global.__conflictRestarting = true
                console.error(chalk.red('WhatsApp stream conflict detected. Another bot instance is using this auth folder; reconnecting is paused to avoid a loop. Stop the other instance, then restart this bot.'))
                try {
                    if (XeonBotInc?.ws && typeof XeonBotInc.ws.close === 'function') XeonBotInc.ws.close()
                } catch (_) {}
                return
            }

            if (isRestartRequired) {
                streamRestartAttempts += 1
                reconnectAttempts = 0
                const restartDelay = Math.min(120000, 15000 * (2 ** Math.min(streamRestartAttempts - 1, 3)))
                console.log(chalk.yellow(`WhatsApp requested a normal stream restart (515). Reconnecting in ${Math.ceil(restartDelay / 1000)}s (attempt ${streamRestartAttempts})...`))
                if (!reconnectTimer) {
                    reconnectTimer = setTimeout(async () => {
                        reconnectTimer = null
                        if (global.__updateRestarting || activeSocket) return
                        await startXeonBotInc()
                    }, restartDelay)
                }
                return
            }

            if (isAckStreamError) {
                ackStreamAttempts += 1
                reconnectAttempts = 0
                const ackDelay = Math.min(90000, 10000 * (2 ** Math.min(ackStreamAttempts - 1, 3)))
                console.warn(chalk.yellow(`WhatsApp ACK stream reset; preserving the paired session and reconnecting in ${Math.ceil(ackDelay / 1000)}s (attempt ${ackStreamAttempts}).`))
                if (!reconnectTimer) {
                    reconnectTimer = setTimeout(async () => {
                        reconnectTimer = null
                        if (global.__updateRestarting || activeSocket) return
                        await startXeonBotInc()
                    }, ackDelay)
                }
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
                console.log(chalk.red('Session logged out. Pair again using the separate pairing site, replace SESSION_BUNDLE, and restart the bot.'))
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

    socketStartInFlight = false
    return XeonBotInc
    } catch (error) {
        socketStartInFlight = false
        activeSocket = null
        if (error?.code === 'NO_SESSION_CONFIGURED' || error?.code === 'SESSION_INPUT_CLOSED' || error?.code === 'ERR_USE_AFTER_CLOSE') {
            console.error(error.message)
            process.exit(1)
        }
        console.error('Error in startXeonBotInc:', error)
        await delay(Math.min(30000, 5000 * Math.max(1, reconnectAttempts)))
        if (!activeSocket && !reconnectTimer && !global.__updateRestarting) startXeonBotInc()
    }
}


// Start the bot with error handling
startXeonBotInc().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
    if (isSignalDecryptError(err)) scheduleSignalSessionRecovery(err)
})

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err)
    if (isSignalDecryptError(err)) scheduleSignalSessionRecovery(err)
})

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`Update ${__filename}`))
    delete require.cache[file]
    require(file)
})
