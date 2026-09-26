import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as alphaTab from '@coderline/alphatab';
import { pdfToTex } from './public/pdftab.js';

// Real Guitar Pro PDF exports; expected values were checked against the printed pages.
const convert = async file => {
  const r = await pdfToTex(pdfjs, new Uint8Array(fs.readFileSync(`test/fixtures/${file}`)), { name: file });
  const score = alphaTab.importer.ScoreLoader.loadAlphaTex(r.tex);
  return { ...r, score, staff: score.tracks[0].staves[0] };
};
// "fret/string" per note (string 1 = high e), duration, then d = dotted, t3 = triplet
const beat = b => `${b.notes.map(n => `${n.fret}/${7 - n.string}`).sort().join('+')}:${b.duration}${b.dots ? 'd' : ''}${b.tupletNumerator > 1 ? `t${b.tupletNumerator}` : ''}`;
const bar = (staff, n) => staff.bars[n - 1].voices[0].beats.map(beat).join(' ');

test('warming up: 40 bars of scales with triplets and three repeated sections', async () => {
  const { score, staff, warnings, title } = await convert('warming-up.pdf');
  assert.equal(title, 'warming-up'); // no title printed, so the file name is used
  assert.equal(score.tempo, 120);
  assert.deepEqual(staff.tuning, [64, 59, 55, 50, 45, 40]);
  assert.equal(staff.bars.length, 40);
  assert.deepEqual(warnings, []);
  assert.equal(bar(staff, 1), '3/6:4 5/5:4 5/4:4 4/3:4');
  assert.equal(bar(staff, 5), '3/6:1');
  assert.equal(bar(staff, 11), '3/6:8 3/6:8 5/5:8 5/5:8 5/4:8 5/4:8 4/3:8 4/3:8');
  assert.equal(bar(staff, 21), '3/6:8t3 3/6:8t3 3/6:8t3 5/5:8t3 5/5:8t3 5/5:8t3 5/4:8t3 5/4:8t3 5/4:8t3 4/3:8t3 4/3:8t3 4/3:8t3');
  assert.equal(bar(staff, 38), '12/1:16 12/1:16 12/1:16 12/1:16 8/1:16 8/1:16 8/1:16 8/1:16 10/2:16 10/2:16 10/2:16 10/2:16 9/3:16 9/3:16 9/3:16 9/3:16');
  const repeats = score.masterBars.map((mb, i) => `${mb.isRepeatStart ? '|:' : ''}${i + 1}${mb.repeatCount ? `:|x${mb.repeatCount}` : ''}`)
    .filter(s => /\D/.test(s));
  assert.deepEqual(repeats, ['10:|x3', '|:11', '20:|x3', '|:21', '30:|x3', '|:31', '40:|x3']);
  score.masterBars.forEach(mb => assert.equal(`${mb.timeSignatureNumerator}/${mb.timeSignatureDenominator}`, '4/4'));
});

test('tremolo picking: sixteenth-note double stops', async () => {
  const { staff, warnings } = await convert('tremolo-picking.pdf');
  assert.deepEqual(warnings, []);
  assert.equal(staff.bars.length, 5);
  const x8 = s => Array(8).fill(s).join(' ');
  assert.equal(bar(staff, 1), `${x8('5/6+7/5:16')} ${x8('5/4+7/5:16')}`);
  assert.equal(bar(staff, 3), `${x8('5/1+6/2:16')} ${x8('6/2+8/1:16')}`);
});

test('stretching exercise: whole-note chords, title and artist from the header', async () => {
  const { score, staff, warnings } = await convert('stretching-exercise.pdf');
  assert.equal(score.title, 'Strechting Exercise');
  assert.equal(score.artist, 'Joe Satriani');
  assert.deepEqual(warnings, ['no tempo shown, using 120 bpm', 'no tuning shown, assuming standard tuning']);
  assert.equal(staff.bars.length, 12);
  assert.equal(bar(staff, 1), '5/4+6/3+7/2+8/1:1');
  assert.equal(bar(staff, 12), '5/3+6/5+7/4+8/6:1');
});

test('string skipping: Qt-based export that draws each character and notehead as font glyphs', async () => {
  const { score, staff, warnings } = await convert('string-skipping-tremolo.pdf');
  assert.equal(score.title, 'String Skipping Tremolo Picking'); // drawn one letter at a time
  assert.equal(score.artist, 'Simon Smith');
  assert.equal(score.tempo, 145);
  assert.deepEqual(warnings, []);
  assert.equal(staff.bars.length, 4);
  const x = (n, s) => Array(n).fill(s).join(' ');
  assert.equal(bar(staff, 1), [x(4, '7/6:16'), x(4, '9/4:16'), x(4, '7/6:16'), x(4, '7/3:16')].join(' '));
  assert.equal(bar(staff, 2), [x(4, '7/6:16'), x(4, '10/4:16'), x(4, '7/6:16'), x(2, '8/2:16'), x(2, '7/2:16')].join(' '));
  assert.equal(bar(staff, 4), [x(4, '3/6:16'), x(4, '6/4:16'), x(4, '3/6:16'), x(2, '4/2:16'), x(2, '3/2:16')].join(' '));
  const repeats = score.masterBars.map(mb => `${mb.isRepeatStart ? '|:' : ''}${mb.repeatCount ? `:|x${mb.repeatCount}` : ''}`);
  assert.deepEqual(repeats, ['|:', ':|x2', '|:', ':|x2']);
});

test('converted tabs survive the Guitar Pro export the library stores', async () => {
  const { score } = await convert('warming-up.pdf');
  const bytes = new alphaTab.exporter.Gp7Exporter().export(score, new alphaTab.Settings());
  const back = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes);
  assert.equal(back.masterBars.length, 40);
  assert.equal(back.tracks[0].staves[0].bars[20].voices[0].beats[0].tupletNumerator, 3);
});
