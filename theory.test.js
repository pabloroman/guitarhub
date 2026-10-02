import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALES, OPEN, scale, chords } from './public/theory.js';

const names = (root, s) => scale(root, s).map(n => n.name).join(' ');
const numerals = (root, s) => chords(root, s).map(c => c.numeral).join(' ');

test('notes are spelled for their key', () => {
  assert.equal(names(5, 'Major'), 'F G A Bb C D E');
  assert.equal(names(3, 'Major'), 'Eb F G Ab Bb C D');
  assert.equal(names(6, 'Major'), 'F# G# A# B C# D# E#');
  assert.equal(names(2, 'Harmonic minor'), 'D E F G A Bb C#');
  assert.equal(names(9, 'Blues'), 'A C D Eb E G');
  assert.equal(names(10, 'Minor pentatonic'), 'Bb Db Eb F Ab');
});

test('a key harmonises into its seven triads', () => {
  assert.deepEqual(chords(0, 'Major').map(c => `${c.name} ${c.quality}`),
    ['C Major', 'D Minor', 'E Minor', 'F Major', 'G Major', 'A Minor', 'B Diminished']);
  assert.equal(numerals(0, 'Major'), 'I ii iii IV V vi vii°');
  assert.equal(numerals(9, 'Minor'), 'i ii° bIII iv v bVI bVII');
  assert.equal(numerals(9, 'Harmonic minor'), 'i ii° bIII+ iv V bVI vii°');
  assert.deepEqual(chords(9, 'Minor pentatonic'), []);
});

const sevenNote = Object.keys(SCALES).filter(s => SCALES[s].split(' ').length === 7);
for (const s of sevenNote) for (let root = 0; root < 12; root++) test(`${names(root, s).split(' ')[0]} ${s} chord shapes sound their triads`, () => {
  for (const c of chords(root, s)) {
    const sounded = c.frets.flatMap((f, i) => f < 0 ? [] : (OPEN[i] + f) % 12), label = `${c.name} ${c.quality}`;
    assert.deepEqual([...new Set(sounded)].sort(), [...c.notes].sort(), label);
    assert.equal(sounded[0], c.root, `${label} has its root in the bass`);
  }
});
