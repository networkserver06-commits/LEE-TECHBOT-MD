'use strict';

function canProcessMessage({ mode, isPublic, isGroup, isOwnerOrSudo }) {
    const current = String(mode || (isPublic ? 'public' : 'private')).toLowerCase();
    if (current === 'private') return Boolean(isOwnerOrSudo);
    if (current === 'dm') return !isGroup;
    if (current === 'group') return Boolean(isGroup);
    return true;
}

module.exports = { canProcessMessage };
