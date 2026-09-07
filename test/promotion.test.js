'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const promotion = require('../commands/promotion');

test('automatic promotion notifications are disabled by default', () => {
    const groupId = 'test-promotion-default@g.us';
    assert.equal(promotion.isPromotionNotificationsEnabled(groupId), false);
});

test('promotion notification setting can be enabled and disabled', () => {
    const groupId = 'test-promotion-toggle@g.us';
    const original = fs.existsSync(promotion.SETTINGS_PATH)
        ? fs.readFileSync(promotion.SETTINGS_PATH, 'utf8')
        : null;
    try {
        promotion.setPromotionNotifications(groupId, true);
        assert.equal(promotion.isPromotionNotificationsEnabled(groupId), true);
        promotion.setPromotionNotifications(groupId, false);
        assert.equal(promotion.isPromotionNotificationsEnabled(groupId), false);
    } finally {
        if (original === null) fs.rmSync(promotion.SETTINGS_PATH, { force: true });
        else fs.writeFileSync(promotion.SETTINGS_PATH, original);
    }
});
