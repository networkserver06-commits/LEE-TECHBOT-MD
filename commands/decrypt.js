const zlib = require('zlib');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// Helper: Standard AES-256-CBC Decryption (Used for standard encrypted configs)
const decryptAES = (buffer, password) => {
    try {
        const key = crypto.createHash('sha256').update(password).digest();
        const iv = buffer.slice(0, 16); 
        const encrypted = buffer.slice(16);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch (e) {
        throw new Error('AES_DECRYPT_FAILED');
    }
};

const universalDecryptCommand = async (sock, chatId, message, isOwnerOrSudoCheck, args) => {
    // 1. Auth Check
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use the decrypter.' }, { quoted: message });
    }

    // 2. Fetch Document
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.documentMessage 
                || message.message?.documentMessage;

    if (!quoted || !quoted.fileName) {
        return await sock.sendMessage(chatId, { text: '❌ Please reply to a VPN config file (.ovpn, .hc, .ehi, etc.)' }, { quoted: message });
    }

    const fileName = quoted.fileName.toLowerCase();
    const password = args[0]; // Optional password for .ovpn files

    try {
        await sock.sendMessage(chatId, { text: `⏳ *Analyzing ${fileName}...*` }, { quoted: message });

        // 3. Download Buffer
        const stream = await downloadContentFromMessage(quoted, 'document');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        let outputData = '';
        let processMethod = 'Unknown';

        // 4. ROUTING LOGIC BASED ON FILE EXTENSION
        if (fileName.endsWith('.ovpn')) {
            // OpenVPN Files
            if (password) {
                try {
                    outputData = decryptAES(buffer, password).toString('utf-8');
                    processMethod = 'AES-256 Decryption';
                } catch (e) {
                    return await sock.sendMessage(chatId, { text: '❌ Invalid password or unsupported OpenVPN encryption format.' }, { quoted: message });
                }
            } else {
                outputData = buffer.toString('utf-8'); // Assume plain text if no pass
                processMethod = 'Plain Text Read';
            }

        } else {
            // Compressed / Injector Files (.hc, .ehi, .ehc, .hat, etc.)
            try {
                outputData = zlib.gunzipSync(buffer).toString('utf-8');
                processMethod = 'Gzip Decompression';
            } catch (e1) {
                try {
                    outputData = zlib.inflateSync(buffer).toString('utf-8');
                    processMethod = 'Zlib Deflate';
                } catch (e2) {
                    // Fallback to reading raw buffer, filtering out non-printable garbage
                    const rawString = buffer.toString('utf-8');
                    // Regex to extract anything that looks like a host, IP, or JSON
                    const extracted = rawString.match(/[\w.-]+(?:\.com|\.net|\.org|:[0-9]+)|\{.*?\}/g);
                    
                    if (extracted && extracted.length > 0) {
                        outputData = extracted.join('\n');
                        processMethod = 'Raw String Extraction (Heavily Encrypted)';
                    } else {
                        throw new Error('CUSTOM_ENCRYPTION');
                    }
                }
            }
        }

        // 5. Try to prettify JSON if the output is JSON
        try {
            const parsed = JSON.parse(outputData);
            outputData = JSON.stringify(parsed, null, 4);
        } catch (e) {
            // Leave as plain text if not JSON
        }

        // 6. Save and Send
        const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const outputFileName = `Unlocked_${safeName}.txt`;
        const tempPath = path.join(__dirname, '../temp', outputFileName);
        
        await fs.writeFile(tempPath, outputData);

        await sock.sendMessage(chatId, { 
            document: await fs.readFile(tempPath),
            fileName: outputFileName,
            mimetype: 'text/plain',
            caption: `✅ *Decryption Complete!*\n\n*File:* ${fileName}\n*Method used:* ${processMethod}\n\n_Note: Passwords/Payloads may still be obfuscated by the app creator._`
        }, { quoted: message });

        // 7. Cleanup
        await fs.unlink(tempPath);

    } catch (error) {
        console.error('Decrypter Error:', error);
        
        let errorMsg = '❌ *Failed to decrypt file.*';
        if (error.message === 'CUSTOM_ENCRYPTION') {
            errorMsg += '\n\nThis file is likely secured with a proprietary app encryption or locked to a Hardware ID (HWID). Standard decrypters cannot bypass app-level binary locks.';
        }
        
        await sock.sendMessage(chatId, { text: errorMsg }, { quoted: message });
    }
};

module.exports = universalDecryptCommand;