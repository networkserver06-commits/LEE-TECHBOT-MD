const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, '..', 'data', 'messageCount.json');

// --- Helper Functions ---

function loadMessageCounts() {
    if (fs.existsSync(dataFilePath)) {
        try {
            const data = fs.readFileSync(dataFilePath);
            return JSON.parse(data);
        } catch (e) {
            return {};
        }
    }
    return {};
}

function saveMessageCounts(messageCounts) {
    fs.writeFileSync(dataFilePath, JSON.stringify(messageCounts, null, 2));
}

function incrementMessageCount(groupId, userId) {
    const messageCounts = loadMessageCounts();
    if (!messageCounts[groupId]) messageCounts[groupId] = {};
    if (!messageCounts[groupId][userId]) messageCounts[groupId][userId] = 0;

    messageCounts[groupId][userId] += 1;
    saveMessageCounts(messageCounts);
}

// --- Commands ---

/**
 * Shows the top 5 most active members in the group
 */
async function topMembers(sock, chatId, isGroup) {
    if (!isGroup) {
        return await sock.sendMessage(chatId, { text: '❌ This command is only available in group chats.' });
    }

    const messageCounts = loadMessageCounts();
    const groupCounts = messageCounts[chatId] || {};

    const sortedMembers = Object.entries(groupCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10); // Expanded to top 10 for better group insight

    if (sortedMembers.length === 0) {
        return await sock.sendMessage(chatId, { text: '📉 No message activity recorded in this group yet.' });
    }

    let message = '🏆 *TOP ACTIVE MEMBERS* 🏆\n\n';
    sortedMembers.forEach(([userId, count], index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
        message += `${medal} @${userId.split('@')[0]} — *${count}* messages\n`;
    });

    await sock.sendMessage(chatId, { 
        text: message, 
        mentions: sortedMembers.map(([userId]) => userId) 
    });
}

/**
 * Checks for members who are currently "active" or have sent a message recently
 */
async function onlineMembers(sock, chatId, isGroup) {
    if (!isGroup) {
        return await sock.sendMessage(chatId, { text: '❌ This command is only available in group chats.' });
    }

    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;
        
        // In Baileys, 'presence' is only tracked if the bot has received a recent update from the user
        // We filter participants who the bot "knows" are currently online or available
        const onlineList = [];
        
        for (const participant of participants) {
            const presence = sock.presence?.[participant.id];
            // If the user is 'composing' (typing) or 'available' (online)
            if (presence?.lastKnownPresence === 'available' || presence?.lastKnownPresence === 'composing') {
                onlineList.push(participant.id);
            }
        }

        if (onlineList.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: '⚠️ *No members are currently visible as online.*\n(Note: Users only appear online if they are typing or have privacy settings off.)' 
            });
        }

        let msg = `🟢 *ONLINE MEMBERS (${onlineList.length})*\n\n`;
        onlineList.forEach(jid => {
            msg += `➤ @${jid.split('@')[0]}\n`;
        });

        await sock.sendMessage(chatId, { text: msg, mentions: onlineList });

    } catch (error) {
        console.error("Error fetching online members:", error);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch group metadata.' });
    }
}

module.exports = { 
    incrementMessageCount, 
    topMembers, 
    onlineMembers 
};