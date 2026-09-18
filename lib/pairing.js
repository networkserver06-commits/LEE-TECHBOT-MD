'use strict';

function formatPairingCode(code) {
    return String(code || '').match(/.{1,4}/g)?.join('-') || String(code || '');
}

function isTransientPairingError(error) {
    const statusCode = error?.output?.statusCode || error?.statusCode;
    return statusCode === 428 || /connection closed|precondition required/i.test(String(error?.message || error));
}

function isQrRefsExpired(error) {
    const statusCode = error?.output?.statusCode || error?.statusCode;
    const text = String(error?.output?.payload?.message || error?.message || error || '');
    return statusCode === 408 && /qr refs attempts ended/i.test(text) || /qr refs attempts ended/i.test(text);
}

function waitForSocket({ getSocket, originalSocket, isActive, delayMs }) {
    return new Promise((resolve) => {
        const started = Date.now();
        const poll = () => {
            const current = getSocket?.() || originalSocket;
            if (current !== originalSocket && current) return resolve(current);
            if (Date.now() - started >= delayMs) return resolve(current === originalSocket ? null : current);
            setTimeout(poll, 100);
        };
        poll();
    });
}

async function requestPairingCodeWithRetry({ socket, getSocket, phoneNumber, isActive = () => true, onTransientError, attempts = 3, retryDelayMs = 2000, logger = console }) {
    let currentSocket = socket;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        if (!isActive() || currentSocket?.authState?.creds?.registered) return null;
        try {
            logger.log?.(`Requesting WhatsApp pairing code for ${phoneNumber} (attempt ${attempt}/${attempts})...`);
            const code = await currentSocket.requestPairingCode(phoneNumber);
            return formatPairingCode(code);
        } catch (error) {
            if (!isTransientPairingError(error) || attempt === attempts) throw error;
            await onTransientError?.(error, currentSocket);
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
            if (!getSocket) continue;
            const nextSocket = await waitForSocket({ getSocket, originalSocket: currentSocket, isActive, delayMs: Math.max(5000, retryDelayMs * 3) });
            if (nextSocket) currentSocket = nextSocket;
        }
    }
    return null;
}

module.exports = { formatPairingCode, isTransientPairingError, isQrRefsExpired, requestPairingCodeWithRetry };
