const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/payment.json');

// Reusable Channel Info
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

// Default fallback text if you haven't set anything yet
const defaultPayment = `💳 *PAYMENT METHODS* 💳
──────────────────
🟢 *M-PESA (Kenya)*
➤ *Number:* 0116553618
➤ *Name:* Lee 

_⚠️ Update this text from WhatsApp by typing:_
*.setpayment <your new payment details>*`;

function getPaymentText() {
    if (!fs.existsSync(dbPath)) {
        // Create the file if it doesn't exist
        if (!fs.existsSync(path.join(__dirname, '../data'))) fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify({ text: defaultPayment }, null, 2));
        return defaultPayment;
    }
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    return data.text || defaultPayment;
}

const paymentCommand = async (sock, chatId, message) => {
    const paymentMsg = getPaymentText();
    await sock.sendMessage(chatId, { text: paymentMsg, ...channelInfo }, { quoted: message });
};

const setPaymentCommand = async (sock, chatId, message, args, isOwner) => {
    if (!isOwner) return await sock.sendMessage(chatId, { text: '❌ Only the owner can update the payment methods.' }, { quoted: message });

    const newText = args.join(' ');
    if (!newText) {
        return await sock.sendMessage(chatId, { text: '❌ Please provide the new payment details.\n\n*Example:*\n.setpayment 💳 My New M-PESA is 0711111111' }, { quoted: message });
    }

    fs.writeFileSync(dbPath, JSON.stringify({ text: newText }, null, 2));
    await sock.sendMessage(chatId, { text: '✅ Payment methods successfully updated!' }, { quoted: message });
};

module.exports = { paymentCommand, setPaymentCommand };