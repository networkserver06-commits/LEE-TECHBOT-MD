'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const payment = require('../commands/payment');

const paymentFile = path.join(__dirname, '../data/payment.json');

test('payment details and HTTPS link survive reload and appear in donate text', () => {
    const previous = fs.existsSync(paymentFile) ? fs.readFileSync(paymentFile) : null;
    try {
        payment.savePayment({ text: 'M-PESA: 254700000000', link: 'https://pay.example.test/lee' });
        assert.equal(payment.readPayment().link, 'https://pay.example.test/lee');
        delete require.cache[require.resolve('../commands/payment')];
        const reloaded = require('../commands/payment');
        assert.match(reloaded.getPaymentText(), /Payment link:\* https:\/\/pay\.example\.test\/lee/);
        assert.equal(reloaded.validPaymentLink('http://pay.example.test/lee'), '');
        reloaded.savePayment({ link: '' });
        assert.doesNotMatch(reloaded.getPaymentText(), /Payment link:/);
    } finally {
        if (previous) fs.writeFileSync(paymentFile, previous); else fs.rmSync(paymentFile, { force: true });
    }
});
