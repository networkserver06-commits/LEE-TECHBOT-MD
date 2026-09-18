'use strict';

function canProcessMessage({ mode, isPublic, isGroup }) {
    const current = String(mode || (isPublic ? 'public' : 'private')).toLowerCase();
    if (current === 'dm') return !isGroup;
    if (current === 'group' || current === 'private') return isGroup;
    return true;
}

module.exports = { canProcessMessage };
