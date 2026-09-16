'use strict';

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/payment.json');
const dataDir = path.dirname(dbPath);

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

const defaultPayment = `💳 *PAYMENT METHODS* 💳
──────────────────
🟢 *M-PESA (Kenya)*
➤ *Number:* 0116553618
➤ *Name:* Lee`;

function readPayment() {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        return { text: data.text || defaultPayment, link: data.link || '' };
    } catch (_) {
        return { text: defaultPayment, link: '' };
    }
}

function savePayment(patch) {
    const payment = { ...readPayment(), ...patch };
    fs.mkdirSync(dataDir, { recursive: true });
    const temporary = `${dbPath}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(payment, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, dbPath);
    return payment;
}

function validPaymentLink(value) {
    try {
        const url = new URL(String(value || '').trim());
        return url.protocol === 'https:' ? url.href : '';
    } catch (_) {
        return '';
    }
}

function getPaymentText() {
    const payment = readPayment();
    if (!fs.existsSync(dbPath)) savePayment(payment);
    return payment.link ? `${payment.text}\n\n🔗 *Payment link:* ${payment.link}` : payment.text;
}

const paymentCommand = async (sock, chatId, message) => {
    await sock.sendMessage(chatId, { text: getPaymentText(), ...channelInfo }, { quoted: message });
};

const setPaymentCommand = async (sock, chatId, message, args, isOwner) => {
    if (!isOwner) return sock.sendMessage(chatId, { text: '❌ Only the owner can update the payment methods.' }, { quoted: message });
    const input = args.join(' ').trim();
    if (!input) return sock.sendMessage(chatId, { text: '❌ Please provide the new payment details.\n\nUsage:\n.setpaypoint <payment details>\n.setpaypoint link https://example.com/pay\n.setpaypoint clearlink' }, { quoted: message });

    if (input.toLowerCase() === 'clearlink') {
        savePayment({ link: '' });
        return sock.sendMessage(chatId, { text: '✅ Payment link removed.' }, { quoted: message });
    }
    if (input.toLowerCase().startsWith('link ')) {
        const link = validPaymentLink(input.slice(5).trim());
        if (!link) return sock.sendMessage(chatId, { text: '❌ Payment links must be valid HTTPS links.' }, { quoted: message });
        savePayment({ link });
        return sock.sendMessage(chatId, { text: '✅ Payment link saved. It will appear in .donate.' }, { quoted: message });
    }
    if (input.toLowerCase().startsWith('text ')) {
        const text = input.slice(5).trim();
        if (!text) return sock.sendMessage(chatId, { text: '❌ Payment text cannot be empty.' }, { quoted: message });
        savePayment({ text });
        return sock.sendMessage(chatId, { text: '✅ Payment details saved.' }, { quoted: message });
    }
    savePayment({ text: input });
    await sock.sendMessage(chatId, { text: '✅ Payment methods successfully updated!' }, { quoted: message });
};

module.exports = { paymentCommand, setPaymentCommand, getPaymentText, readPayment, savePayment, validPaymentLink };
