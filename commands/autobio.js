global.autobioState = global.autobioState || 'off';
global.autobioInterval = global.autobioInterval || null;

const autobioCommand = async (sock, chatId, message, isOwnerOrSudoCheck, userMessage) => {
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use Auto-Bio.' }, { quoted: message });
    }

    const arg = userMessage.split(' ')[1]?.toLowerCase();

    if (arg === 'on') {
        global.autobioState = 'on';
        await sock.sendMessage(chatId, { text: '✅ Auto-Bio is turned *ON*. Your profile status will now update automatically.' });
        
        // Clear any existing interval just in case
        if (global.autobioInterval) clearInterval(global.autobioInterval);
        
        // Start the background loop (Updates every 60 seconds)
        global.autobioInterval = setInterval(async () => {
            let time = new Date().toLocaleTimeString('en-US', { timeZone: 'Africa/Nairobi' }); // Matches EAT Timezone
            let bioText = `🤖 LEE TECHBot MD | ⏰ Time: ${time} | 🚀 Powered by Lee Tech`;
            await sock.updateProfileStatus(bioText).catch(() => {});
        }, 60000);
        
    } else if (arg === 'off') {
        global.autobioState = 'off';
        if (global.autobioInterval) {
            clearInterval(global.autobioInterval);
            global.autobioInterval = null;
        }
        await sock.sendMessage(chatId, { text: '❌ Auto-Bio is turned *OFF*.' });
    } else {
        await sock.sendMessage(chatId, { text: `📝 Usage: .autobio on/off\nCurrent status: *${global.autobioState}*` });
    }
};

module.exports = autobioCommand;