import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
import { SCALES, CHORD_TYPES, OPEN, PROGRESSIONS, scale, chord, chords, shape, voicings, positions, scaleTex, chordsTex } from './public/theory.js';

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

test('position 1 of A minor pentatonic is the box at the 5th fret', () => {
  assert.deepEqual(positions(OPEN, scale(9, 'Minor pentatonic'))[0].map(n => n.fret), [5, 8, 5, 7, 5, 7, 5, 7, 5, 8, 5, 8]);
  assert.deepEqual(positions(OPEN, scale(9, 'Blues'))[0].map(n => n.fret), [5, 8, 5, 6, 7, 5, 7, 5, 7, 8, 5, 8, 5, 8]);
});

for (const s in SCALES) test(`${s} positions climb the scale on every root`, () => {
  for (let root = 0; root < 12; root++) {
    const notes = scale(root, s), pcs = notes.map(n => n.pc), all = positions(OPEN, notes);
    assert.equal(all.length, notes.length === 6 ? 5 : notes.length, `${notes[0].name}: every position fits on the neck`);
    for (const p of all) {
      const pitches = p.map(n => OPEN[n.string] + n.fret);
      assert.ok(pitches.every((x, i) => i === 0 || x > pitches[i - 1]), 'rising pitch');
      assert.ok(p.every((n, i) => n.fret >= 0 && n.fret <= 17 && pcs.includes(pitches[i] % 12)), 'on the neck and in the scale');
      if (notes.length !== 6) for (let string = 0; string < 6; string++) assert.equal(p.filter(n => n.string === string).length, notes.length === 7 ? 3 : 2);
    }
    assert.equal((OPEN[0] + all[0][0].fret) % 12, root, 'position 1 starts on the root');
  }
});

// a 4/4 bar is 3840 ticks (960 per quarter)
const fullBars = tex => {
  const bars = alphaTab.importer.ScoreLoader.loadAlphaTex(tex).tracks[0].staves[0].bars;
  for (const b of bars) assert.equal(b.voices[0].beats.reduce((t, x) => t + x.playbackDuration, 0), 3840, `bar ${b.index + 1} of ${tex}`);
  return bars;
};

for (const s in SCALES) test(`${s} positions and progressions make playable tab`, () => {
  for (let root = 0; root < 12; root++) {
    const notes = scale(root, s), list = chords(root, s);
    for (const p of positions(OPEN, notes)) {
      const played = fullBars(scaleTex(OPEN, p)).flatMap(b => b.voices[0].beats).filter(b => !b.isRest).map(b => b.notes[0].realValue);
      assert.deepEqual(played.slice(0, p.length), p.map(n => OPEN[n.string] + n.fret));
    }
    if (list.length) for (const set of Object.values(PROGRESSIONS)) for (const { degrees } of set) {
      const bars = fullBars(chordsTex(OPEN, degrees.map(i => list[i])));
      assert.equal(bars.length, degrees.length);
      assert.deepEqual(bars[0].voices[0].beats[0].notes.map(n => n.realValue % 12).sort(), [...list[degrees[0]].frets.flatMap((f, i) => f < 0 ? [] : (OPEN[i] + f) % 12)].sort());
    }
  }
});

const sounded = frets => frets.flatMap((f, i) => f < 0 ? [] : (OPEN[i] + f) % 12);
const text = frets => frets.map(f => f < 0 ? 'x' : f).join('');

test('the chord finder finds the textbook open chords', () => {
  const found = (root, type) => voicings(OPEN, root, type).map(text);
  assert.ok(found(0, 'Major').includes('x32010'), found(0, 'Major').join(' '));
  assert.ok(found(7, 'Major').includes('320003'), found(7, 'Major').join(' '));
  assert.ok(found(9, 'Minor').includes('x02210'), found(9, 'Minor').join(' '));
  assert.ok(found(2, 'Dominant 7th').includes('xx0212'), found(2, 'Dominant 7th').join(' '));
  assert.ok(found(4, 'Dominant 7th').includes('020100'), found(4, 'Dominant 7th').join(' '));
  assert.ok(found(0, 'Major 7th').includes('x32000'), found(0, 'Major 7th').join(' '));
  assert.equal(chord(0, 'Diminished 7th').map(n => n.name).join(' '), 'C Eb Gb Bbb');
  assert.equal(chord(10, 'Dominant 9th').map(n => n.name).join(' '), 'Bb D F Ab C');
});

for (const type in CHORD_TYPES) test(`${type} voicings are playable on every root`, () => {
  for (let root = 0; root < 12; root++) {
    const tones = chord(root, type).map(n => n.pc), all = voicings(OPEN, root, type);
    assert.ok(all.length >= 3, `${chord(root, type)[0].name}: only ${all.map(text)}`);
    for (const frets of all) {
      const pcs = sounded(frets), fretted = frets.filter(f => f > 0);
      assert.equal(pcs[0], root, `${text(frets)} has its root in the bass`);
      assert.ok(pcs.every(pc => tones.includes(pc)), `${text(frets)} only has chord notes`);
      assert.ok(tones.every((pc, i) => pcs.includes(pc) || (i === 2 && tones.length > 3)), `${text(frets)} has every note but maybe the 5th`);
      assert.ok(Math.max(...fretted) - Math.min(...fretted) <= 3, `${text(frets)} fits one hand`);
    }
  }
});
