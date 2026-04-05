const linkCommand = async (sock, chatId, message, isGroup, isBotAdmin) => {
    // 1. Security & Requirement Checks
    if (!isGroup) {
        return await sock.sendMessage(chatId, { text: '❌ This command can only be used inside groups.' }, { quoted: message });
    }
    if (!isBotAdmin) {
        return await sock.sendMessage(chatId, { text: '❌ I need to be an Admin to generate the group link!' }, { quoted: message });
    }

    await sock.sendMessage(chatId, { text: '⏳ *Generating link...*' }, { quoted: message });

    try {
        // 2. Ask WhatsApp for the group's invite code
        const inviteCode = await sock.groupInviteCode(chatId);
        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
        
        // 3. Get the group's name so the message looks nice
        const metadata = await sock.groupMetadata(chatId);
        const groupName = metadata.subject;

        // 4. Send the beautiful final message
        const finalMessage = `🔗 *Invite Link for ${groupName}*\n\n👉 ${inviteLink}`;

        await sock.sendMessage(chatId, { 
            text: finalMessage,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363404186001130@newsletter',
                    newsletterName: 'LEE TECHBOT MD',
                    serverMessageId: -1
                }
            }
        }, { quoted: message });

    } catch (error) {
        console.error('Error fetching group link:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to get the group link. WhatsApp might be restricting me.' }, { quoted: message });
    }
};

module.exports = linkCommand;