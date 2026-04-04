const groupVcfCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isOwnerOrSudoCheck) => {
    // 1. Security Checks
    if (!isGroup) {
        return await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
    }
    
    // Privacy feature: Only allow admins or the bot owner to mass-extract numbers
    if (!isSenderAdmin && !isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only group admins or the bot owner can extract group contacts.' }, { quoted: message });
    }

    await sock.sendMessage(chatId, { text: '⏳ *Extracting contacts...* Please wait.' }, { quoted: message });

    try {
        // 2. Fetch all members
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;
        const groupName = groupMetadata.subject || 'WhatsApp Group';

        // 3. Build the VCF string
        let vcfString = '';
        for (let participant of participants) {
            const phoneNumber = participant.id.split('@')[0];
            
            vcfString += 'BEGIN:VCARD\n';
            vcfString += 'VERSION:3.0\n';
            // Saves them in your phone as "Group Name - 254123456789"
            vcfString += `FN:${groupName} - ${phoneNumber}\n`; 
            vcfString += `TEL;type=CELL;type=VOICE;waid=${phoneNumber}:+${phoneNumber}\n`;
            vcfString += 'END:VCARD\n';
        }

        // 4. Send as a downloadable document
        await sock.sendMessage(chatId, {
            document: Buffer.from(vcfString, 'utf-8'),
            fileName: `${groupName}_Contacts.vcf`,
            mimetype: 'text/vcard',
            caption: `✅ Successfully extracted *${participants.length}* contacts from *${groupName}*.\n\n📥 Open this file to save them to your phone!`
        }, { quoted: message });

    } catch (error) {
        console.error("Error generating group VCF:", error);
        await sock.sendMessage(chatId, { text: '❌ Failed to generate the contacts file. Ensure the bot is still in the group.' });
    }
};

module.exports = groupVcfCommand;