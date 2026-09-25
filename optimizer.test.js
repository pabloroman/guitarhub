import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimize, STYLES } from './public/optimizer.js';

const E_STD = [40, 45, 50, 55, 59, 64]; // string 1 = low E
const single = (string, fret, locked = false) => [{ string, fret, locked }];

test('riff jumping 12 -> 3 -> 12 on one string collapses into one position', () => {
  const beats = [single(1, 12), single(1, 3), single(1, 12), single(1, 3), single(1, 12)];
  const r = optimize({ open: E_STD, beats });
  const frets = r.beats.flat().map(n => n.fret).filter(f => f > 0);
  assert.ok(Math.max(...frets) - Math.min(...frets) <= 4, JSON.stringify(r.beats)); // one hand position, stretch allowed
  assert.ok(r.after < r.before);
  // pitches preserved
  r.beats.forEach((b, i) => assert.equal(E_STD[b[0].string - 1] + b[0].fret, E_STD[0] + beats[i][0].fret));
});

test('locked notes (bends, slides, ties) never move', () => {
  const beats = [single(1, 12, true), single(1, 3), single(1, 12, true)];
  const r = optimize({ open: E_STD, beats });
  assert.deepEqual(r.beats[0], [{ string: 1, fret: 12 }]);
  assert.deepEqual(r.beats[2], [{ string: 1, fret: 12 }]);
});

test('already comfortable passage is left alone', () => {
  // open E5, then a 0-3-5 riff into an A5 power chord
  const beats = [
    [{ string: 1, fret: 0 }, { string: 2, fret: 2 }, { string: 3, fret: 2 }],
    single(1, 0), single(1, 3), single(1, 5),
    [{ string: 1, fret: 5 }, { string: 2, fret: 7 }],
  ];
  const r = optimize({ open: E_STD, beats });
  assert.deepEqual(r.beats, beats.map(b => b.map(({ string, fret }) => ({ string, fret }))));
  assert.equal(r.after, r.before);
});

test('respects drop/down tunings', () => {
  const D_STD = [38, 43, 48, 53, 57, 62];
  const beats = [single(1, 10), single(1, 2), single(1, 10)];
  const r = optimize({ open: D_STD, beats });
  r.beats.forEach((b, i) => assert.equal(D_STD[b[0].string - 1] + b[0].fret, D_STD[0] + beats[i][0].fret));
});

// "8B/4 7B/8" -> beats + gaps (seconds to the next note) at a tempo; strings named E A D G B e.
// A "||" marks a new section (tempo change): the hand may move freely there.
const NAMES = ['', 'E', 'A', 'D', 'G', 'B', 'e'];
function phrase(text, bpm) {
  const beats = [], gaps = [];
  for (const t of text.split(' ')) {
    if (t === '||') { gaps[gaps.length - 1] = Infinity; continue; }
    const m = t.match(/(\d+)(\w)\/(\d+)/);
    beats.push([{ string: NAMES.indexOf(m[2]), fret: +m[1], locked: false }]);
    gaps.push((4 / m[3]) * (60 / bpm));
  }
  return { beats, gaps };
}
const show = beats => beats.map(b => b[0].fret + NAMES[b[0].string]).join(' ');

test('position style: Windir "Arntor" lead, bars 1-2 played in 5th position (how the player actually plays it)', () => {
  const { beats, gaps } = phrase('8B/4 7B/8 7G/8 10B/4 11B/8 8B/8 8G/4 10D/8 8G/8 8B/4 7B/4 10B/2 11B/4 8B/4 11B/4 7B/4 8B/2', 90);
  const r = optimize({ open: E_STD, beats, gaps }, STYLES.position);
  assert.equal(show(r.beats.slice(0, 11)), '8B 7B 7G 5e 6e 8B 8G 5G 8G 8B 7B');
});

test('power chord riffs keep their shape on the low strings', () => {
  const pc = (e, a) => [{ string: 1, fret: e, locked: false }, { string: 2, fret: a, locked: false }];
  const beats = [pc(5, 7), pc(3, 5), pc(5, 7), pc(7, 9)];
  assert.deepEqual(optimize({ open: E_STD, beats }).beats, beats.map(b => b.map(({ string, fret }) => ({ string, fret }))));
});

test('string style: a fast one-string melody stays on its string', () => {
  const { beats, gaps } = phrase('15B/16 13B/16 11B/16 13B/16 10B/16 11B/16 13B/16 15B/16', 180);
  const r = optimize({ open: E_STD, beats, gaps }, STYLES.string);
  assert.equal(show(r.beats), '15B 13B 11B 13B 10B 11B 13B 15B');
});

test('position style: Satyricon "Taakeslottet" bars 23-28, the outlier bar 25 moves up, not bars 26-27 down', () => {
  const bars = ['9A/4 7A/8 8E/8 7E/2', '0E/4 7E/8 9A/8 10A/8 9A/8 7A/4', '4D/4 5D/8 2G/8 5D/8 4D/8 5D/4',
    '0E/4 7E/8 9A/8 10A/8 9A/8 7A/4', '9A/4 7A/8 8E/8 7E/2', '||', '0E/4 3A/8 2A/8 3A/8 2A/4'];
  const { beats, gaps } = phrase(bars.join(' '), 110); // bar 28 starts a new section at 115 bpm
  const r = optimize({ open: E_STD, beats, gaps }, STYLES.position);
  const expected = [...bars.slice(0, 2), '9A 10A 7D 10A 9A 10A', ...bars.slice(3, 5), ...bars.slice(6)]
    .join(' ').replace(/\/\d+/g, '');
  assert.equal(show(r.beats), expected);
});
