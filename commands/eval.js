const util = require('util');

const evalCommand = async (sock, chatId, message, isOwnerOrSudoCheck, rawText) => {
    // SECURITY CRITICAL: Only the bot owner can execute raw code
    if (!isOwnerOrSudoCheck) {
        return; // Silently ignore to prevent abuse
    }

    const code = rawText.slice(5).trim(); // Remove '.eval'
    if (!code) {
        return await sock.sendMessage(chatId, { text: '📝 Provide some JavaScript code to evaluate.' }, { quoted: message });
    }

    try {
        // Execute the code
        let evaled = await eval(code);
        
        // Format the output cleanly
        if (typeof evaled !== 'string') {
            evaled = util.inspect(evaled, { depth: 2 });
        }
        
        await sock.sendMessage(chatId, { text: `*✅ EVAL RESULT:*\n\n\`\`\`javascript\n${evaled}\n\`\`\`` }, { quoted: message });
    } catch (err) {
        // Return errors so you can debug your code
        await sock.sendMessage(chatId, { text: `*❌ EVAL ERROR:*\n\n\`\`\`javascript\n${err.message}\n\`\`\`` }, { quoted: message });
    }
};

module.exports = evalCommand;