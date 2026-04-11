const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363404186001130@newsletter',
            newsletterName: 'LEE TECHBOT MD',
            serverMessageId: -1
        }
    }
};

const handleJoinApproval = async (sock, chatId, message, senderId, args, action, isGroup, isBotAdmin, isSenderAdmin) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' });
    if (!isBotAdmin) return await sock.sendMessage(chatId, { text: '❌ Make the bot an admin first to use this feature.' });
    if (!isSenderAdmin && !message.key.fromMe) return await sock.sendMessage(chatId, { text: '❌ Only group admins can use this command.' });

    try {
        // --- 1. TOGGLE EXPLANATION ---
        if (action === 'joinapproval') {
            return await sock.sendMessage(chatId, { 
                text: `🛡️ *Join Approval Manager*\n\nMake sure you have enabled "Approve New Participants" in your Group Settings!\n\n*Commands:*\n➤ *.approve list* (Shows pending requests)\n➤ *.approve all* (Accepts everyone)\n➤ *.reject all* (Rejects everyone)\n➤ *.approve @user* (Accept specific user)`,
                ...channelInfo 
            });
        }

        // --- 2. APPROVE / REJECT LOGIC ---
        if (action === 'approve' || action === 'reject') {
            
            // Fetch pending requests from WhatsApp
            let pendingRequests = [];
            try {
                pendingRequests = await sock.groupRequestParticipantsList(chatId);
            } catch (e) {
                return await sock.sendMessage(chatId, { text: '❌ Failed to fetch list. Make sure "Approve new participants" is turned ON in your WhatsApp Group Settings.' });
            }

            if (!pendingRequests || pendingRequests.length === 0) {
                return await sock.sendMessage(chatId, { text: '✅ There are no pending join requests right now.' });
            }

            const param = args[0]?.toLowerCase();

            // .approve list
            if (!param || param === 'list') {
                let listText = `📋 *PENDING JOIN REQUESTS* 📋\nTotal Waiting: ${pendingRequests.length}\n\n`;
                pendingRequests.forEach((req, index) => {
                    listText += `${index + 1}. @${req.jid.split('@')[0]}\n`;
                });
                listText += `\n*Commands:*\n➤ .approve all\n➤ .reject all\n➤ .approve @user`;
                
                return await sock.sendMessage(chatId, { 
                    text: listText, 
                    mentions: pendingRequests.map(r => r.jid),
                    ...channelInfo 
                });
            }

            // .approve all  OR  .reject all
            if (param === 'all') {
                await sock.sendMessage(chatId, { text: `⏳ Processing ${pendingRequests.length} requests...` });
                
                const jids = pendingRequests.map(req => req.jid);
                
                // Tell WhatsApp to process the bulk array
                await sock.groupRequestParticipantsUpdate(chatId, jids, action);
                
                const actionText = action === 'approve' ? 'APPROVED' : 'REJECTED';
                return await sock.sendMessage(chatId, { text: `✅ Successfully *${actionText}* ALL pending requests!`, ...channelInfo });
            }

            // .approve @user  OR  .reject @user
            const mentionedJidList = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentionedJidList.length > 0) {
                // Verify the mentioned user is actually in the waiting room
                const validJids = mentionedJidList.filter(jid => pendingRequests.some(req => req.jid === jid));
                
                if (validJids.length === 0) {
                    return await sock.sendMessage(chatId, { text: `❌ The mentioned user(s) are not in the pending request list.` });
                }

                await sock.groupRequestParticipantsUpdate(chatId, validJids, action);
                const actionText = action === 'approve' ? 'APPROVED' : 'REJECTED';
                return await sock.sendMessage(chatId, { text: `✅ Successfully *${actionText}* the mentioned user(s)!`, ...channelInfo });
            }

            return await sock.sendMessage(chatId, { text: `❌ Invalid format. Use:\n*.approve list*\n*.approve all*\n*.approve @user*` });
        }

    } catch (error) {
        console.error('Error in join approval command:', error);
        await sock.sendMessage(chatId, { text: '❌ An error occurred while managing join requests.' });
    }
};

module.exports = handleJoinApproval;