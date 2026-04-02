const settings = require('../settings');

const vcfCommand = async (sock, chatId, message) => {
    // This grabs the bot's current phone number. 
    // If you want it to send YOUR personal owner number instead, 
    // replace `sock.user.id.split(':')[0]` with your number, e.g., '254123456789'
    const ownerNumber = sock.user.id.split(':')[0]; 
    
    // Build the vCard (Virtual Contact File) format
    const vcard = 'BEGIN:VCARD\n' +
                  'VERSION:3.0\n' +
                  `FN:${settings.botOwner || 'Lee Tech'}\n` +
                  `ORG:${settings.botName || 'LEE TECHBot MD'};\n` +
                  `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\n` +
                  'END:VCARD';
    
    // Send the contact card to the chat
    await sock.sendMessage(chatId, {
        contacts: {
            displayName: settings.botOwner || 'Lee Tech',
            contacts: [{ vcard }]
        }
    }, { quoted: message });
};

module.exports = vcfCommand;