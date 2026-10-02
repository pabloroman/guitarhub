import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTES, SCALES, OPEN, chords } from './public/theory.js';

test('C major harmonises into its seven triads', () => {
  assert.deepEqual(chords(0, 'Major').map(c => `${NOTES[c.root]} ${c.quality}`),
    ['C Major', 'D Minor', 'E Minor', 'F Major', 'G Major', 'A Minor', 'B Diminished']);
});

for (const scale in SCALES) NOTES.forEach((name, root) => test(`${name} ${scale} chord shapes sound their triads`, () => {
  for (const c of chords(root, scale)) {
    const sounded = c.frets.flatMap((f, i) => f < 0 ? [] : (OPEN[i] + f) % 12), label = `${NOTES[c.root]} ${c.quality}`;
    assert.deepEqual([...new Set(sounded)].sort(), [...c.notes].sort(), label);
    assert.equal(sounded[0], c.root, `${label} has its root in the bass`);
  }
}));
