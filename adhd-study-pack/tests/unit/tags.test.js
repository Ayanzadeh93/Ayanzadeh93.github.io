import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugTag,
  parseTagInput,
  normaliseCatalog,
  matchesTagAndPriority,
  mergeTagIds,
  defaultCatalog
} from '../../js/lib/tags.js';

describe('Category tags', () => {
  it('slugs names and parses a short list', () => {
    assert.equal(slugTag(' Deep Work '), 'deep-work');
    assert.deepEqual(parseTagInput('reading, lab; reading'), ['reading', 'lab']);
  });

  it('ships starters only when no catalog was saved', () => {
    assert.equal(defaultCatalog().length, 6);
    assert.equal(normaliseCatalog(undefined).length, 6);
    assert.deepEqual(normaliseCatalog([]), []);
  });

  it('merges a tag filter with a priority filter', () => {
    const readingQ2 = { tags: ['reading'], quad: 'q2' };
    const readingQ1 = { tags: ['reading'], quad: 'q1' };
    const labQ2 = { tags: ['lab'], quad: 'q2' };
    const lens = { tag: 'reading', quad: 'q2' };
    assert.equal(matchesTagAndPriority(readingQ2, lens), true);
    assert.equal(matchesTagAndPriority(readingQ1, lens), false);
    assert.equal(matchesTagAndPriority(labQ2, lens), false);
    assert.equal(matchesTagAndPriority({ tags: [], quad: null }, { tag: '', quad: 'none' }), true);
  });

  it('folds one tag into another without touching priority', () => {
    const next = mergeTagIds([
      { id: 'a', quad: 'q1', tags: ['lab', 'reading'] },
      { id: 'b', quad: 'q2', tags: ['admin'] }
    ], 'lab', 'reading');
    assert.deepEqual(next[0].tags, ['reading']);
    assert.equal(next[0].quad, 'q1');
    assert.deepEqual(next[1].tags, ['admin']);
    assert.equal(next[1].quad, 'q2');
  });
});
