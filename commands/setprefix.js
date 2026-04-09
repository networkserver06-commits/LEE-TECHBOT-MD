const fs = require('fs');
const path = require('path');

const prefixPath = path.join(__dirname, '../data/prefix.json');

const setPrefixCommand = async (sock, chatId, message, isOwnerOrSudoCheck, userMessage) => {
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the owner can change the prefix.' }, { quoted: message });
    }

    const newPrefix = userMessage.split(' ')[1];

    if (!newPrefix) {
        return await sock.sendMessage(chatId, { text: '📝 Usage: .setprefix [symbol]\nExample: .setprefix !' }, { quoted: message });
    }

    // Save the new prefix permanently
    fs.writeFileSync(prefixPath, JSON.stringify({ prefix: newPrefix }, null, 2));

    await sock.sendMessage(chatId, { text: `✅ Prefix successfully and permanently changed to: *${newPrefix}*` }, { quoted: message });
};

module.exports = setPrefixCommand;