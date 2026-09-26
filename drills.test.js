import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
import { DRILLS } from './public/drills.js';

for (const d of DRILLS) d.levels.forEach((l, i) => test(`${d.key} level ${i + 1} parses into full 4/4 bars`, () => {
  assert.ok(l.start_bpm < l.target_bpm);
  const bars = alphaTab.importer.ScoreLoader.loadAlphaTex(l.alphatex).tracks[0].staves[0].bars;
  assert.equal(bars.length, 2);
  // a 4/4 bar is 3840 ticks (960 per quarter)
  for (const b of bars) assert.equal(b.voices[0].beats.reduce((t, x) => t + x.playbackDuration, 0), 3840, `bar ${b.index + 1}`);
}));
