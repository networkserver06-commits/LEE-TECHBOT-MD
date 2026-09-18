'use strict';

function canProcessMessage({ isPublic, isGroup }) {
    // Private mode means group-only operation: no DM command or reply is
    // processed, including owner, sudo, and developer DMs. Public mode keeps
    // the normal all-chat behavior.
    return Boolean(isPublic || isGroup);
}

module.exports = { canProcessMessage };
