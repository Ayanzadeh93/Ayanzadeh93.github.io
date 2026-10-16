/* The public study card. Only these fields may leave the device.
   Tasks, notes, email, and coach keys never appear here. */

import { normaliseUsername } from './passport.js';

export const CARD_KEYS = ['name', 'username', 'bio', 'avatar', 'level', 'xp', 'minutes', 'streak', 'updated'];
const PHOTO_MAX = 120000;

export function shareablePhoto(avatar) {
  const s = String(avatar || '');
  if (!/^data:image\/(jpeg|png);base64,/.test(s)) return '';
  return s.length <= PHOTO_MAX ? s : '';
}

function clamp(n, max) {
  const v = Math.round(Number(n) || 0);
  if (v < 0) return 0;
  return v > max ? max : v;
}

/** The exact document written to profiles/{uid}. */
export function publicCardBody(input, now = Date.now()) {
  const src = input || {};
  const name = String(src.name || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return {
    name: name || 'Student',
    username: normaliseUsername(src.username),
    bio: String(src.bio || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 280),
    avatar: shareablePhoto(src.avatar),
    level: Math.max(1, clamp(src.level, 12)),
    xp: clamp(src.xp, 100000000),
    minutes: clamp(src.minutes, 100000000),
    streak: clamp(src.streak, 10000),
    updated: clamp(now, 9999999999999)
  };
}
