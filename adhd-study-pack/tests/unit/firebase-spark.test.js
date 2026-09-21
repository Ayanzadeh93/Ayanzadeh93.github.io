import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldShowPhoneSignIn,
  normalisePhoneE164,
  isAppCheckDebugHost
} from '../../js/lib/firebase-spark.js';

describe('Spark Firebase helpers', () => {
  it('gates phone UI on Remote Config unless CFG forces it', () => {
    assert.equal(shouldShowPhoneSignIn(false, undefined), false);
    assert.equal(shouldShowPhoneSignIn(true, undefined), true);
    assert.equal(shouldShowPhoneSignIn(false, true), true);
    assert.equal(shouldShowPhoneSignIn(true, false), false);
  });

  it('normalises US and E.164 phone numbers', () => {
    assert.equal(normalisePhoneE164('+1 (410) 555-0100'), '+14105550100');
    assert.equal(normalisePhoneE164('4105550100'), '+14105550100');
    assert.equal(normalisePhoneE164('14105550100'), '+14105550100');
    assert.equal(normalisePhoneE164('not a phone'), '');
    assert.equal(normalisePhoneE164(''), '');
  });

  it('treats localhost as App Check debug', () => {
    assert.equal(isAppCheckDebugHost('localhost'), true);
    assert.equal(isAppCheckDebugHost('127.0.0.1'), true);
    assert.equal(isAppCheckDebugHost('www.ayanzadeh.com'), false);
  });
});
