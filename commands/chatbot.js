const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { configured: aiConfigured, generateChatCompletion } = require('../lib/ai_provider');
const { getMetaAi } = require('./groupFeatures');
const { configured: grokConfigured, generateGrokCompletion } = require('./groq');
const { resolveGroupTarget, fetchParticipatingGroups } = require('../lib/groupTarget');

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// In-memory storage for chat history and user info
const chatMemory = {
    messages: new Map(), // Stores last 5 messages per user
    userInfo: new Map()  // Stores user information
};
const responseLocks = new Set();

function chatbotEnabled(value) {
    return value === true || value?.enabled === true;
}
function chatbotMode(value) {
    return value?.mode || 'constant';
}

function chatbotSettingsText(data, chatId, isOwnerDm = false) {
    const configured = data.chatbot?.[chatId];
    const enabled = chatbotEnabled(configured);
    const provider = configured?.provider || 'auto';
    const scope = isOwnerDm ? 'Owner DM' : (chatId?.endsWith('@g.us') ? 'This group' : 'Private chat');
    const groupsEnabled = Object.entries(data.chatbot || {}).filter(([jid, value]) => jid.endsWith('@g.us') && chatbotEnabled(value)).length;
    return `🤖 *LEE TECH CHATBOT SETTINGS*\n\n` +
        `Status: *${enabled ? 'ON' : 'OFF'}*\n` +
        `Scope: *${scope}*\n` +
        `Provider: *${provider}* (Grok/Groq: ${grokConfigured() ? 'available' : 'not configured'}; fallback AI: ${aiConfigured() ? 'available' : 'not configured'})\n` +
        `Language: *Auto — English or Kiswahili*\n` +
        `Other languages: *Only when explicitly requested*\n` +
        `Group chatbot instances enabled: *${groupsEnabled}*\n` +
        `Contact DMs: *${data.chatbotContacts ? 'ON' : 'OFF'}*\n` +
        `Conversation memory: *Last 20 messages per sender*\n` +
        `Response mode: *${chatbotMode(configured)} — automatic replies while enabled*\n\n` +
        `*CONTROLS*\n` +
        `• .chatbot on|off — current group (constant mode)\n` +
        `• .chatbot constant on|off — explicitly control continuous replies\n` +
        `• .chatbot settings — show this page\n` +
        `• Owner DM: .chatbot <group number> on|off|status\n` +
        `• Owner DM: .chatbot DM on|off|status\n` +
        `• Owner DM: .chatbot DM constant on|off\n` +
        `• Owner DM: .chatbot contacts on|off|status`;
}

// Load user group data
function loadUserGroupData() {
    try {
        return JSON.parse(fs.readFileSync(USER_GROUP_DATA));
    } catch (error) {
        console.error('❌ Error loading user group data:', error.message);
        return { groups: [], chatbot: {} };
    }
}

// Save user group data
function saveUserGroupData(data) {
    try {
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ Error saving user group data:', error.message);
    }
}

// Add random delay between 2-5 seconds
function getRandomDelay() {
    return Math.floor(Math.random() * 3000) + 2000;
}

// Add typing indicator
async function showTyping(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
    } catch (error) {
        console.error('Typing indicator error:', error);
    }
}

// Extract user information from messages
function extractUserInfo(message) {
    const info = {};

    // Extract name
    if (message.toLowerCase().includes('my name is')) {
        info.name = message.split('my name is')[1].trim().split(' ')[0];
    }

    // Extract age
    if (message.toLowerCase().includes('i am') && message.toLowerCase().includes('years old')) {
        info.age = message.match(/\d+/)?.[0];
    }

    // Extract location
    if (message.toLowerCase().includes('i live in') || message.toLowerCase().includes('i am from')) {
        info.location = message.split(/(?:i live in|i am from)/i)[1].trim().split(/[.,!?]/)[0];
    }

    return info;
}

async function handleChatbotCommand(sock, chatId, message, match, options = {}) {
    const requested = String(match || '').trim().toLowerCase();
    if (requested === 'settings' || requested === 'config' || requested === 'info') {
        return sock.sendMessage(chatId, { text: chatbotSettingsText(loadUserGroupData(), chatId, Boolean(options.isOwnerDm)) }, { quoted: message });
    }
    if (options.isOwnerDm) {
        const dmParts = String(match || '').trim().split(/\s+/).filter(Boolean);
        if (dmParts[0]?.toLowerCase() === 'dm') {
            const modeRequested = String(dmParts[1] || '').toLowerCase() === 'constant';
            const action = String(dmParts[modeRequested ? 2 : 1] || '').toLowerCase();
            const data = loadUserGroupData();
            data.chatbot = data.chatbot || {};
            if (!['on', 'off', 'status'].includes(action)) {
                return sock.sendMessage(chatId, { text: 'Usage: .chatbot DM on|off|status or .chatbot DM constant on|off' }, { quoted: message });
            }
            if (action === 'status') {
                return sock.sendMessage(chatId, { text: `🤖 *DM chatbot*: ${chatbotEnabled(data.chatbot[chatId]) ? 'ON' : 'OFF'}` }, { quoted: message });
            }
            if (action === 'on') data.chatbot[chatId] = { enabled: true, provider: 'auto', scope: 'dm', mode: 'constant' };
            else delete data.chatbot[chatId];
            saveUserGroupData(data);
            return sock.sendMessage(chatId, { text: `✅ DM chatbot turned *${action.toUpperCase()}*.` }, { quoted: message });
        }
        if (dmParts[0]?.toLowerCase() === 'contacts') {
            const action = String(dmParts[1] || '').toLowerCase();
            const data = loadUserGroupData();
            data.chatbot = data.chatbot || {};
            if (!['on', 'off', 'status'].includes(action)) {
                return sock.sendMessage(chatId, { text: 'Usage: .chatbot contacts on|off|status' }, { quoted: message });
            }
            if (action === 'status') {
                return sock.sendMessage(chatId, { text: `👥 *Contact chatbot*: ${data.chatbotContacts ? 'ON' : 'OFF'}` }, { quoted: message });
            }
            data.chatbotContacts = action === 'on';
            saveUserGroupData(data);
            return sock.sendMessage(chatId, { text: `✅ Contact chatbot turned *${action.toUpperCase()}*.` }, { quoted: message });
        }
        if (/^(status|show|list)$/i.test(String(match || '').trim())) {
            const data = loadUserGroupData();
            data.chatbot = data.chatbot || {};
            try {
                const groups = await fetchParticipatingGroups(sock);
                const lines = groups.length
                    ? groups.map((group) => `${chatbotEnabled(data.chatbot[group.jid]) ? '✅ ON ' : '❌ OFF'}  ${group.index}. ${group.subject || group.jid}\n   ${group.number}`)
                    : ['No participating groups found.'];
                return sock.sendMessage(chatId, { text: `🤖 *GROUP CHATBOT STATUS*\n\n${lines.join('\n\n')}\n\nUse .chatbot <group number> on|off to change a group.` }, { quoted: message });
            } catch (error) {
                console.error('[chatbot status]', error.message || error);
                return sock.sendMessage(chatId, { text: '❌ Could not fetch the current group list.' }, { quoted: message });
            }
        }
        const parts = String(match || '').trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 3 && String(parts[parts.length - 2]).toLowerCase() === 'constant') parts.splice(parts.length - 2, 1);
        const action = String(parts.pop() || '').toLowerCase();
        const target = await resolveGroupTarget(sock, chatId, parts.join(' '));
        if (target.error || !['on', 'off', 'status'].includes(action)) {
            return sock.sendMessage(chatId, { text: target.error || 'Usage: .chatbot <group number or list number> on|off|status\nUse .listgroup first to see group numbers.' }, { quoted: message });
        }
        const data = loadUserGroupData();
        data.chatbot = data.chatbot || {};
        if (action === 'status') {
            return sock.sendMessage(chatId, { text: `🤖 Chatbot for *${target.subject || target.jid}*: ${chatbotEnabled(data.chatbot[target.jid]) ? 'ON' : 'OFF'}` }, { quoted: message });
        }
        data.chatbot[target.jid] = { enabled: action === 'on', provider: 'auto', mode: 'constant' };
        saveUserGroupData(data);
        return sock.sendMessage(chatId, { text: `✅ Chatbot turned *${action.toUpperCase()}* for *${target.subject || target.jid}*.` }, { quoted: message });
    }
    if (!match) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: `${chatbotSettingsText(loadUserGroupData(), chatId)}\n\nUse *.chatbot on* or *.chatbot off* to change the current group.`,
            quoted: message
        });
    }

    const data = loadUserGroupData();
    data.chatbot = data.chatbot || {};
    const constantParts = String(match || '').trim().split(/\s+/).filter(Boolean);
    if (constantParts[0]?.toLowerCase() === 'constant') {
        const constantAction = String(constantParts[1] || '').toLowerCase();
        if (!['on', 'off'].includes(constantAction)) {
            return sock.sendMessage(chatId, { text: 'Usage: .chatbot constant on|off' }, { quoted: message });
        }
        match = constantAction;
    }

    // Get bot's number
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

    // Check if sender is bot owner
    const senderId = message.key.participant || message.participant || message.pushName || message.key.remoteJid;
    const isOwner = senderId === botNumber;

    // If it's the bot owner, allow access immediately
    if (isOwner) {
        if (match === 'on') {
            await showTyping(sock, chatId);
            if (chatbotEnabled(data.chatbot[chatId])) {
                return sock.sendMessage(chatId, {
                    text: '*Chatbot is already enabled for this group*',
                    quoted: message
                });
            }
            data.chatbot[chatId] = { enabled: true, provider: 'auto', mode: 'constant' };
            saveUserGroupData(data);
            console.log(`✅ Chatbot enabled for group ${chatId}`);
            return sock.sendMessage(chatId, {
                text: '*Chatbot has been enabled for this group*',
                quoted: message
            });
        }

        if (match === 'off') {
            await showTyping(sock, chatId);
            if (!chatbotEnabled(data.chatbot[chatId])) {
                return sock.sendMessage(chatId, {
                    text: '*Chatbot is already disabled for this group*',
                    quoted: message
                });
            }
            delete data.chatbot[chatId];
            saveUserGroupData(data);
            console.log(`✅ Chatbot disabled for group ${chatId}`);
            return sock.sendMessage(chatId, {
                text: '*Chatbot has been disabled for this group*',
                quoted: message
            });
        }
    }

    // For non-owners, check admin status
    let isAdmin = false;
    if (chatId.endsWith('@g.us')) {
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));
        } catch (e) {
            console.warn('⚠️ Could not fetch group metadata. Bot might not be admin.');
        }
    }

    if (!isAdmin && !isOwner) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: '❌ Only group admins or the bot owner can use this command.',
            quoted: message
        });
    }

    if (match === 'on') {
        await showTyping(sock, chatId);
        if (chatbotEnabled(data.chatbot[chatId])) {
            return sock.sendMessage(chatId, {
                text: '*Chatbot is already enabled for this group*',
                quoted: message
            });
        }
            data.chatbot[chatId] = { enabled: true, provider: 'auto', mode: 'constant' };
        saveUserGroupData(data);
        console.log(`✅ Chatbot enabled for group ${chatId}`);
        return sock.sendMessage(chatId, {
            text: '*Chatbot has been enabled for this group*',
            quoted: message
        });
    }

    if (match === 'off') {
        await showTyping(sock, chatId);
            if (!chatbotEnabled(data.chatbot[chatId])) {
            return sock.sendMessage(chatId, {
                text: '*Chatbot is already disabled for this group*',
                quoted: message
            });
        }
        delete data.chatbot[chatId];
        saveUserGroupData(data);
        console.log(`✅ Chatbot disabled for group ${chatId}`);
        return sock.sendMessage(chatId, {
            text: '*Chatbot has been disabled for this group*',
            quoted: message
        });
    }

    await showTyping(sock, chatId);
    return sock.sendMessage(chatId, {
        text: '*Invalid command. Use .chatbot to see usage*',
        quoted: message
    });
}

async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const isGroup = chatId?.endsWith('@g.us');
    const isOwnerDm = !isGroup && chatId && senderId && chatId === senderId;
    const data = loadUserGroupData();
    data.chatbot = data.chatbot || {};
    const isContactDm = !isGroup && !isOwnerDm && data.chatbotContacts === true;
    if ((!isGroup && !isOwnerDm && !isContactDm) || !String(userMessage || '').trim()) return;
    if (!chatbotEnabled(data.chatbot?.[chatId]) && !isContactDm) return;
    if (responseLocks.has(chatId)) return;
    responseLocks.add(chatId);

    try {
        // Get bot's ID - try multiple formats
        const botId = sock.user.id;
        const botNumber = botId.split(':')[0];
        const botLid = sock.user.lid; // Get the actual LID from sock.user
        const botJids = [
            botId,
            `${botNumber}@s.whatsapp.net`,
            `${botNumber}@whatsapp.net`,
            `${botNumber}@lid`,
            botLid, // Add the actual LID
            botLid ? `${botLid.split(':')[0]}@lid` : null // Add LID without session part
        ].filter(Boolean);

        // Check for mentions and replies
        let isBotMentioned = false;
        let isReplyToBot = false;

        // Check if message is a reply and contains bot mention
        if (message.message?.extendedTextMessage) {
            const mentionedJid = message.message.extendedTextMessage.contextInfo?.mentionedJid || [];
            const quotedParticipant = message.message.extendedTextMessage.contextInfo?.participant;

            // Check if bot is mentioned in the reply
            isBotMentioned = mentionedJid.some(jid => {
                const jidNumber = jid.split('@')[0].split(':')[0];
                return botJids.some(botJid => {
                    const botJidNumber = botJid.split('@')[0].split(':')[0];
                    return jidNumber === botJidNumber;
                });
            });

            // Check if replying to bot's message
            if (quotedParticipant) {
                // Normalize both quoted and bot IDs to compare cleanly
                const cleanQuoted = quotedParticipant.replace(/[:@].*$/, '');
                isReplyToBot = botJids.some(botJid => {
                    const cleanBot = botJid.replace(/[:@].*$/, '');
                    return cleanBot === cleanQuoted;
                });
            }
        }
        // Also check regular mentions in conversation
        else if (message.message?.conversation) {
            isBotMentioned = userMessage.includes(`@${botNumber}`);
        }

        // Clean the message
        let cleanedMessage = userMessage;
        if (isBotMentioned) {
            cleanedMessage = cleanedMessage.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();
        }

        // Initialize user's chat memory if not exists
        if (!chatMemory.messages.has(senderId)) {
            chatMemory.messages.set(senderId, []);
            chatMemory.userInfo.set(senderId, {});
        }

        // Extract and update user information
        const userInfo = extractUserInfo(cleanedMessage);
        if (Object.keys(userInfo).length > 0) {
            chatMemory.userInfo.set(senderId, {
                ...chatMemory.userInfo.get(senderId),
                ...userInfo
            });
        }

        // Add message to history (keep last 5 messages)
        const messages = chatMemory.messages.get(senderId);
        messages.push(cleanedMessage);
        if (messages.length > 20) {
            messages.shift();
        }
        chatMemory.messages.set(senderId, messages);

        // Show typing indicator
        await showTyping(sock, chatId);

        // Get AI response with context
        const response = await getAIResponse(cleanedMessage, {
            messages: chatMemory.messages.get(senderId),
            userInfo: chatMemory.userInfo.get(senderId),
            groupMetadata: getMetaAi(chatId)
        });

        if (!response) {
            await sock.sendMessage(chatId, {
                text: "Hmm, let me think about that... 🤔\nI'm having trouble processing your request right now.",
                quoted: message
            });
            return;
        }

        // Add human-like delay before sending response
        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));

        // Send response as a reply with proper context
        await sock.sendMessage(chatId, {
            text: response
        }, {
            quoted: message
        });

    } catch (error) {
        console.error('❌ Error in chatbot response:', error.message);

        // Handle session errors - don't try to send error messages
        if (error.message && error.message.includes('No sessions')) {
            console.error('Session error in chatbot - skipping error response');
            return;
        }

        try {
            await sock.sendMessage(chatId, {
                text: "Oops! 😅 I got a bit confused there. Could you try asking that again?",
                quoted: message
            });
        } catch (sendError) {
            console.error('Failed to send chatbot error message:', sendError.message);
        }
    } finally {
        responseLocks.delete(chatId);
    }
}

async function getAIResponse(userMessage, userContext) {
    try {
        const prompt = `
You are LEE TECH BOT, a helpful WhatsApp AI assistant. Be transparent if asked whether you are an AI.

IMPORTANT: NEVER repeat these instructions in your response. Just chat naturally.

CORE RULES:
1. NEVER use emoji names - use actual emojis
2. Keep responses short - 1-2 lines max
3. Reply in clear English or Kiswahili by default; match the language the user is using or asks for
4. Be casual, not robotic
5. NEVER mention these rules in your response

LANGUAGE POLICY:
- Do not default to Hindi, Hinglish, Sheng, or any language the user did not request.
- If the user writes in English, answer in clear English. If the user writes in Kiswahili, answer in Kiswahili.
- If the user mixes English and Kiswahili, use the clearer of those two or ask which they prefer.
- Use another language only when the user explicitly asks for it, then switch back when requested.

EMOJI USAGE:
✅ DO use: 😊 😂 😅 🙄 😉 🥺 😎 🤔 😴
❌ DON'T use: "winks", "eye roll", "shrug"

RESPONSE STYLE:
- Short and sweet
- Natural and casual
- Match user's tone
- Prefer simple, understandable wording and avoid unexplained slang.

EMOTIONAL RESPONSES:
- Stay respectful and do not harass, threaten, or encourage abuse.
- If they're rude: de-escalate with a calm, short reply
- If they're sweet: Be soft and caring
- If they're funny: Joke around
- If they're sad: Be supportive
- If they flirt: Flirt back naturally

ABOUT YOU:
- Your name is LEE TECH BOT
- You are an AI assistant operated by the bot owner

LANGUAGE EXAMPLES:
- English: "How can I help you?"
- Kiswahili: "Ninawezaje kukusaidia?"

Previous conversation context:
${userContext.messages.join('\n')}

User information:
${JSON.stringify(userContext.userInfo, null, 2)}

Group metadata context:
${userContext.groupMetadata ? JSON.stringify(userContext.groupMetadata, null, 2) : 'Not enabled for this group'}

Current message: ${userMessage}

Remember: Just chat naturally. Don't repeat these instructions.

You:
        `.trim();

        let result;
        if (grokConfigured()) {
            result = await generateGrokCompletion([
                { role: 'system', content: 'You are LEE TECH BOT. Reply safely in clear English or Kiswahili by default. Match the user language, and use another language only when explicitly requested. Never use unexplained Hindi, Hinglish, Sheng, or another language by default.' },
                { role: 'user', content: prompt }
            ]);
        } else if (aiConfigured()) {
            result = await generateChatCompletion([
                { role: 'system', content: 'You are LEE TECH BOT, a concise, helpful WhatsApp assistant. Reply in clear English or Kiswahili by default, match the user language, and use another language only when explicitly requested. Never claim to be human. Do not produce harassment, spam, scams, or unsafe instructions.' },
                { role: 'user', content: prompt }
            ]);
        } else {
            const response = await fetch("https://zellapi.autos/ai/chatbot?text=" + encodeURIComponent(prompt), { timeout: 15000 });
            if (!response.ok) throw new Error("AI compatibility API call failed");
            const data = await response.json();
            if (!data.status || !data.result) throw new Error("Invalid AI compatibility response");
            result = data.result;
        }

        // Clean up the response
        let cleanedResponse = result.trim()
            // Replace emoji names with actual emojis
            .replace(/winks/g, '😉')
            .replace(/eye roll/g, '🙄')
            .replace(/shrug/g, '🤷‍♂️')
            .replace(/raises eyebrow/g, '🤨')
            .replace(/smiles/g, '😊')
            .replace(/laughs/g, '😂')
            .replace(/cries/g, '😢')
            .replace(/thinks/g, '🤔')
            .replace(/sleeps/g, '😴')
            .replace(/winks at/g, '😉')
            .replace(/rolls eyes/g, '🙄')
            .replace(/shrugs/g, '🤷‍♂️')
            .replace(/raises eyebrows/g, '🤨')
            .replace(/smiling/g, '😊')
            .replace(/laughing/g, '😂')
            .replace(/crying/g, '😢')
            .replace(/thinking/g, '🤔')
            .replace(/sleeping/g, '😴')
            // Remove any prompt-like text
            .replace(/Remember:.*$/g, '')
            .replace(/IMPORTANT:.*$/g, '')
            .replace(/CORE RULES:.*$/g, '')
            .replace(/EMOJI USAGE:.*$/g, '')
            .replace(/RESPONSE STYLE:.*$/g, '')
            .replace(/EMOTIONAL RESPONSES:.*$/g, '')
            .replace(/ABOUT YOU:.*$/g, '')
            .replace(/SLANG EXAMPLES:.*$/g, '')
            .replace(/Previous conversation context:.*$/g, '')
            .replace(/User information:.*$/g, '')
            .replace(/Current message:.*$/g, '')
            .replace(/You:.*$/g, '')
            // Remove any remaining instruction-like text
            .replace(/^[A-Z\s]+:.*$/gm, '')
            .replace(/^[•-]\s.*$/gm, '')
            .replace(/^✅.*$/gm, '')
            .replace(/^❌.*$/gm, '')
            // Clean up extra whitespace
            .replace(/\n\s*\n/g, '\n')
            .trim();

        return cleanedResponse;
    } catch (error) {
        console.error("AI API error:", error);
        return null;
    }
}

module.exports = {
    handleChatbotCommand,
    handleChatbotResponse
};
