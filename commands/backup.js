const fs = require('fs');
const path = require('path');

const backupCommand = async (sock, chatId, message, isOwnerOrSudoCheck) => {
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Security Error: Only the Bot Owner can download the database backup.' }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { text: '⏳ Generating secure database backup...' }, { quoted: message });

        // Path to your main database/config file
        const dbPath = path.join(process.cwd(), 'data', 'messageCount.json'); 
        
        if (fs.existsSync(dbPath)) {
            const dbBuffer = fs.readFileSync(dbPath);
            
            await sock.sendMessage(chatId, { 
                document: dbBuffer, 
                mimetype: 'application/json', 
                fileName: `LEE_TECH_Backup_${Date.now()}.json`,
                caption: '🛡️ *DATABASE BACKUP SUCCESSFUL*\n\nKeep this file safe. It contains your bot\'s memory and user states.'
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: '❌ Database file not found.' });
        }
    } catch (error) {
        console.error("Backup Error:", error);
        await sock.sendMessage(chatId, { text: `❌ Backup failed: ${error.message}` });
    }
};

module.exports = backupCommand;