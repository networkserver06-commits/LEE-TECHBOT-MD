const settings = require('../settings');
const { isSudo } = require('./index');

async function isOwnerOrSudo(senderId, sock = null, chatId = null) {
    const numericPart = (value) => String(value || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    const senderNumeric = numericPart(senderId);
    const ownerNumberClean = String(settings.ownerNumber || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    const superOwnerNumberClean = String(settings.superOwnerNumber || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    const ownerNumbers = [ownerNumberClean, superOwnerNumberClean].filter(Boolean);
    const ownerJids = ownerNumbers.map((number) => `${number}@s.whatsapp.net`);

    // The linked account can differ from OWNER_NUMBER when pairing is done
    // through the website or a panel. Treat the live socket identity as an
    // owner identity in both DMs and groups, including phone JIDs and LIDs.
    const linkedNumbers = [
        sock?.user?.id,
        sock?.user?.jid,
        sock?.user?.lid,
        sock?.authState?.creds?.me?.id,
        sock?.authState?.creds?.me?.jid,
        sock?.authState?.creds?.me?.lid
    ]
        .map(numericPart)
        .filter(Boolean);
    if (senderNumeric && linkedNumbers.includes(senderNumeric)) return true;

    // Some Baileys updates expose a LID as the sender while the account's
    // phone identity is stored in `creds.me`. Compare the raw normalized
    // identity as well, not only its phone-number digits.
    const normalizeJid = (value) => String(value || '').trim().toLowerCase().split(':')[0];
    const senderJid = normalizeJid(senderId);
    const linkedJids = [
        sock?.user?.id,
        sock?.user?.jid,
        sock?.user?.lid,
        sock?.authState?.creds?.me?.id,
        sock?.authState?.creds?.me?.jid,
        sock?.authState?.creds?.me?.lid
    ].map(normalizeJid).filter(Boolean);
    if (senderJid && linkedJids.includes(senderJid)) return true;
    
    // Direct JID match
    if (ownerJids.includes(senderId)) {
        return true;
    }
    
    // Extract sender's numeric parts
    const senderIdClean = senderId.split(':')[0].split('@')[0];
    const senderLidNumeric = senderId.includes('@lid') ? senderId.split('@')[0].split(':')[0] : '';
    
    // Check if sender's phone number matches owner number
    if (ownerNumbers.includes(senderIdClean)) {
        return true;
    }
    
    // In groups, check if sender's LID matches bot's LID (owner uses same account as bot)
    if (sock && chatId && chatId.endsWith('@g.us') && senderId.includes('@lid')) {
        try {
            // Get bot's LID numeric
            const botLid = sock.user?.lid || '';
            const botLidNumeric = botLid.includes(':') ? botLid.split(':')[0] : (botLid.includes('@') ? botLid.split('@')[0] : botLid);
            
            // Check if sender's LID numeric matches bot's LID numeric
            if (senderLidNumeric && botLidNumeric && senderLidNumeric === botLidNumeric) {
                return true;
            }
            
            // Also check participant data for additional matching
            const metadata = await sock.groupMetadata(chatId);
            const participants = metadata.participants || [];
            
            const participant = participants.find(p => {
                const pLid = p.lid || '';
                const pLidNumeric = pLid.includes(':') ? pLid.split(':')[0] : (pLid.includes('@') ? pLid.split('@')[0] : pLid);
                const pId = p.id || '';
                const pIdClean = pId.split(':')[0].split('@')[0];
                
                return (
                    p.lid === senderId || 
                    p.id === senderId ||
                    pLidNumeric === senderLidNumeric ||
                    pIdClean === senderIdClean ||
                    ownerNumbers.includes(pIdClean)
                );
            });
            
            if (participant) {
                const participantId = participant.id || '';
                const participantLid = participant.lid || '';
                const participantIdClean = participantId.split(':')[0].split('@')[0];
                const participantLidNumeric = participantLid.includes(':') ? participantLid.split(':')[0] : (participantLid.includes('@') ? participantLid.split('@')[0] : participantLid);
                
                if (ownerJids.includes(participantId) ||
                    ownerNumbers.includes(participantIdClean) ||
                    participantLidNumeric === botLidNumeric) {
                    return true;
                }
            }
        } catch (e) {
            console.error('❌ [isOwner] Error checking participant data:', e);
        }
    }
    
    // Check if sender ID contains owner number (fallback)
    if (ownerNumbers.some((number) => senderId.includes(number))) {
        return true;
    }
    
    // Check sudo status
    try {
        return Boolean(await isSudo(senderId));
    } catch (e) {
        console.error('❌ [isOwner] Error checking sudo:', e);
        return false;
    }
}

module.exports = isOwnerOrSudo;
