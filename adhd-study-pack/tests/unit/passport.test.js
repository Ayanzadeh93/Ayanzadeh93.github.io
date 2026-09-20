import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACHIEVEMENTS,
  emptyPassport,
  normalisePassport,
  initialsOf,
  computeStats,
  achievementProgress,
  earnedKeys,
  freshKeys,
  adoptKeys,
  getAchievement,
  sessionStamp
} from '../../js/lib/passport.js';

describe('Passport achievements', () => {
  it('ships fifty FocusQuest milestones with unique keys and icons', () => {
    assert.equal(ACHIEVEMENTS.length, 50);
    const keys = ACHIEVEMENTS.map(a => a.key);
    assert.equal(new Set(keys).size, 50);
    assert.ok(keys.includes('first_spark'));
    assert.ok(keys.includes('legend'));
    assert.ok(keys.includes('focus_sovereign'));
    ACHIEVEMENTS.forEach(a => {
      assert.ok(a.title && a.description && a.icon);
      assert.ok(a.sessions || a.minutes || a.streak);
    });
  });

  it('computes session count, minutes and a back-from-today streak', () => {
    const today = new Date();
    const day = offset => {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      d.setHours(10, 0, 0, 0);
      return d.toISOString();
    };
    const stats = computeStats([
      { minutes: 25, start: day(0) },
      { minutes: 25, start: day(1) },
      { minutes: 10, at: Date.parse(day(2)) }
    ]);
    assert.equal(stats.sessions, 3);
    assert.equal(stats.minutes, 60);
    assert.equal(stats.streak, 3);
  });

  it('lets a streak start yesterday if nothing is logged today', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(9, 0, 0, 0);
    const stats = computeStats([{ minutes: 25, start: d.toISOString() }]);
    assert.equal(stats.streak, 1);
  });

  it('unlocks first spark, hour hero and a 3-day streak together', () => {
    const today = new Date();
    const rows = [0, 1, 2].map(offset => {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      return { minutes: 25, start: d.toISOString() };
    });
    const keys = earnedKeys(computeStats(rows));
    assert.ok(keys.includes('first_spark'));
    assert.ok(keys.includes('hour_hero'));
    assert.ok(keys.includes('streak_3'));
    assert.equal(keys.includes('legend'), false);
    assert.equal(keys.includes('focus_sovereign'), false);
  });

  it('reports only unseen keys as fresh, then adopts them', () => {
    const stats = { sessions: 5, minutes: 60, streak: 1 };
    const first = freshKeys(stats, []);
    assert.ok(first.includes('first_spark'));
    assert.ok(first.includes('warmed_up'));
    assert.ok(first.includes('hour_hero'));
    const { passport, fresh } = adoptKeys({ seen: ['first_spark'] }, stats);
    assert.ok(passport.seen.includes('warmed_up'));
    assert.equal(fresh.includes('first_spark'), false);
    assert.ok(fresh.includes('warmed_up'));
    const silent = adoptKeys(passport, stats, { silent: true });
    assert.deepEqual(silent.fresh, []);
  });

  it('progress is 0..1 against the matching target', () => {
    const a = getAchievement('hour_hero');
    assert.equal(achievementProgress(a, { sessions: 0, minutes: 30, streak: 0 }), 0.5);
    assert.equal(achievementProgress(a, { sessions: 0, minutes: 60, streak: 0 }), 1);
  });
});

describe('Passport profile', () => {
  it('normalises missing or hostile input', () => {
    assert.deepEqual(normalisePassport(null), emptyPassport());
    const p = normalisePassport({
      displayName: 'A'.repeat(200),
      bio: 'B'.repeat(400),
      avatar: 'javascript:alert(1)',
      seen: ['first_spark', 'not-a-badge', 12]
    });
    assert.equal(p.displayName.length, 80);
    assert.equal(p.bio.length, 280);
    assert.equal(p.avatar, '');
    assert.deepEqual(p.seen, ['first_spark']);
  });

  it('keeps a data-URL avatar and initials from a display name', () => {
    const p = normalisePassport({ avatar: 'data:image/jpeg;base64,qq' });
    assert.equal(p.avatar.startsWith('data:image/'), true);
    assert.equal(initialsOf('Aydin Ayanzadeh'), 'AA');
    assert.equal(initialsOf('user@site.com'), 'U');
    assert.equal(initialsOf(''), '?');
  });

  it('reads session timestamps from at, start or created_at', () => {
    const t = Date.parse('2026-09-20T10:00:00Z');
    assert.equal(sessionStamp({ at: t }), t);
    assert.equal(sessionStamp({ start: '2026-09-20T10:00:00Z' }), t);
    assert.equal(sessionStamp({ created_at: '2026-09-20T10:00:00Z' }), t);
  });
});
