'use strict';

function formatPairingCode(code) {
    return String(code || '').match(/.{1,4}/g)?.join('-') || String(code || '');
}

function isTransientPairingError(error) {
    const statusCode = error?.output?.statusCode || error?.statusCode;
    return statusCode === 428 || /connection closed|precondition required/i.test(String(error?.message || error));
}

async function requestPairingCodeWithRetry({ socket, phoneNumber, isActive = () => true, attempts = 3, retryDelayMs = 2000, logger = console }) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        if (!isActive() || socket?.authState?.creds?.registered) return null;
        try {
            logger.log?.(`Requesting WhatsApp pairing code for ${phoneNumber} (attempt ${attempt}/${attempts})...`);
            const code = await socket.requestPairingCode(phoneNumber);
            return formatPairingCode(code);
        } catch (error) {
            if (!isTransientPairingError(error) || attempt === attempts) throw error;
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
    }
    return null;
}

module.exports = { formatPairingCode, isTransientPairingError, requestPairingCodeWithRetry };
