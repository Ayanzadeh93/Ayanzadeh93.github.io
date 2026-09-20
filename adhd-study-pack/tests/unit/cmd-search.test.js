import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/** Mirror of the palette agent-prefix parser in adhd-study-pack.js */
function parseAgentShortcut(raw) {
  const q = String(raw || '').trim();
  const m = q.match(/^(?:\/(?:ask|coach|ai|agent|llm)|(?:ask|ai|agent|llm)\s*:|@coach)\s+([\s\S]+)$/i)
    || q.match(/^(?:ask|ai|agent|llm)\s+(.+)$/i);
  if (!m) return null;
  return m[1].trim();
}

describe('Command palette agent shortcuts', () => {
  it('parses /ask, ai:, @coach and bare ask prefixes', () => {
    assert.equal(parseAgentShortcut('/ask brief me'), 'brief me');
    assert.equal(parseAgentShortcut('ai: what next'), 'what next');
    assert.equal(parseAgentShortcut('AI: list tasks'), 'list tasks');
    assert.equal(parseAgentShortcut('@coach play rain'), 'play rain');
    assert.equal(parseAgentShortcut('agent: start focus'), 'start focus');
    assert.equal(parseAgentShortcut('llm help me start'), 'help me start');
    assert.equal(parseAgentShortcut('ask what should I do'), 'what should I do');
  });

  it('ignores ordinary navigation queries', () => {
    assert.equal(parseAgentShortcut('plan'), null);
    assert.equal(parseAgentShortcut('go to focus'), null);
    assert.equal(parseAgentShortcut('/help'), null);
    assert.equal(parseAgentShortcut(''), null);
  });
});
