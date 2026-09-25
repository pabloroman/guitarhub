// Fingering optimizer: Viterbi over beats. State = (candidate fingering, hand anchor fret).
// Pure data in/out so it runs in the browser and under `node --test`.
//
// input: { open: [midi of string 1 (lowest), string 2, ...], maxFret,
//          beats: [[{ string, fret, locked }]],   (rests excluded by caller)
//          gaps: [seconds from each beat to the next one] }   (optional: all shifts count as fast;
//                 Infinity = a new section starts, the hand can move freely)
// output: { beats: [[{ string, fret }]] (same order as input notes), before, after }

// ponytail: hand-tuned weights, this is the calibration knob — adjust after trying real tabs.
export const STYLES = {
  // One finger per fret, move the hand as little as possible; changing strings is cheap.
  position: {
    shift: 1,      // per fret the hand anchor moves
    shiftBase: 6,  // any position shift at all
    stretch: 2,    // chord needing a 5-fret span
    cross: 0.1,    // per string crossed between consecutive beats
    skip: 0.5,     // extra per string skipped over
    chordGap: 3,   // per muted string inside a chord shape
    high: 0.1,     // per fret above 12
    change: 1,     // per note moved away from the tab's original fingering
  },
  // Keep melodies on one string and slide along it (tremolo picking): string changes cost more than shifts.
  string: {
    shift: 0.5, shiftBase: 0.5, stretch: 2, cross: 2, skip: 1, chordGap: 3, high: 0.1, change: 1,
  },
};

// A changed passage must save at least this much, or it is left as written (about one fast position shift).
export const MIN_GAIN = 3;

const SPAN = 3;       // anchor p covers frets p..p+3 with one finger per fret
const MAX_CANDS = 16; // keep the cheapest N fingerings per beat
const FAST = 0.25;    // seconds: a shift with less time than this costs full price; more time makes it cheaper
const MIN_TIME_FACTOR = 0.15;

// All valid (string, fret) assignments for one beat's notes.
function candidates(notes, open, maxFret, w) {
  const options = notes.map(n => {
    const pitch = open[n.string - 1] + n.fret;
    if (n.locked) return [{ string: n.string, fret: n.fret }];
    const opts = [];
    open.forEach((o, i) => {
      const f = pitch - o;
      if (f >= 0 && f <= maxFret) opts.push({ string: i + 1, fret: f });
    });
    return opts;
  });
  const out = [];
  const walk = (i, acc, used) => {
    if (i === options.length) { out.push(acc); return; }
    for (const o of options[i]) {
      if (used.has(o.string)) continue;
      const next = [...acc, o];
      const fr = next.filter(x => x.fret > 0).map(x => x.fret);
      if (fr.length && Math.max(...fr) - Math.min(...fr) > SPAN + 1) continue;
      walk(i + 1, next, new Set(used).add(o.string));
    }
  };
  walk(0, [], new Set());
  const best = out
    .map(c => ({ c, cost: intrinsic(c, notes, w) }))
    .sort((a, b) => a.cost - b.cost)
    .slice(0, MAX_CANDS);
  // the original fingering always stays possible, even if it breaks our span rules
  const original = notes.map(n => ({ string: n.string, fret: n.fret }));
  if (!best.some(x => same(x.c, original))) best.push({ c: original, cost: intrinsic(original, notes, w) });
  return best;
}

const same = (a, b) => a.every((x, i) => x.string === b[i].string && x.fret === b[i].fret);
// Same chord shape on the same strings, just moved along the neck (e.g. a power chord slide).
const sameShape = (a, b) => a.length > 1 && a.length === b.length
  && a.every((x, i) => x.string === b[i].string && x.fret - a[0].fret === b[i].fret - b[0].fret);

function intrinsic(c, notes, w) {
  const fr = c.filter(x => x.fret > 0).map(x => x.fret);
  let cost = 0;
  if (fr.length && Math.max(...fr) - Math.min(...fr) > SPAN) cost += w.stretch;
  for (const f of fr) if (f > 12) cost += w.high * (f - 12);
  const strings = c.map(x => x.string).sort((a, b) => a - b);
  for (let i = 1; i < strings.length; i++) cost += w.chordGap * (strings[i] - strings[i - 1] - 1);
  // chord shapes (power chords) keep their strings for tone; moving them costs 3x a melody note
  const change = c.length > 1 ? w.change * 3 : w.change;
  c.forEach((x, i) => { if (x.string !== notes[i].string) cost += change; });
  return cost;
}

// Hand anchors compatible with a fingering; open-only fingerings keep whatever anchor the hand has.
function anchors(c) {
  const fr = c.filter(x => x.fret > 0).map(x => x.fret);
  if (!fr.length) return null;
  const lo = Math.min(...fr), hi = Math.max(...fr);
  const res = [];
  for (let p = Math.max(1, hi - SPAN); p <= lo; p++) res.push(p);
  return res.length ? res : [lo]; // stretch: index finger on the lowest fret
}

const meanString = c => c.reduce((s, x) => s + x.string, 0) / c.length;

export function optimize({ open, maxFret = 24, beats, gaps = [] }, w = STYLES.position, minGain = MIN_GAIN) {
  const run = pin => viterbi(open, maxFret, beats.map((b, i) => b.map(n => ({ ...n, locked: n.locked || pin(i) }))), gaps, w);
  const before = run(() => true);
  let after = run(() => false);
  // Re-run with each changed passage pinned to the original; keep the change only if it saves enough.
  // ponytail: one full Viterbi per passage (~20ms each on a 600-note track), window it if big tabs get slow.
  const pinned = new Set();
  for (const seg of passages(after.beats, beats)) {
    const without = run(i => pinned.has(i) || seg.includes(i));
    if (without.cost - after.cost < minGain) { seg.forEach(i => pinned.add(i)); after = without; }
  }
  return { beats: after.beats, before: before.cost, after: after.cost };
}

// Changed beat indices, grouped into passages (changes at most 3 beats apart belong together).
function passages(result, beats) {
  const out = [];
  result.forEach((c, i) => {
    if (same(c, beats[i])) return;
    const last = out.at(-1);
    if (last && i - last.at(-1) <= 3) last.push(i); else out.push([i]);
  });
  return out;
}

function viterbi(open, maxFret, beats, gaps, w) {
  if (!beats.length) return { beats: [], cost: 0 };
  const allAnchors = Array.from({ length: maxFret }, (_, i) => i + 1);
  let layer = null; // states { c, p, m (mean string), cost, prev }
  beats.forEach((notes, k) => {
    // shifting during a long note or rest is easy; between two fast notes it is not
    const time = k && gaps[k - 1] ? Math.max(MIN_TIME_FACTOR, Math.min(1, FAST / gaps[k - 1])) : 1;
    const next = [];
    for (const { c, cost: ic } of candidates(notes, open, maxFret, w)) {
      const m = meanString(c);
      for (const p of anchors(c) ?? allAnchors) {
        let best = layer ? Infinity : 0, prev = null;
        if (layer) for (const s of layer) {
          const d = Math.abs(s.p - p), x = Math.abs(s.m - m);
          const slide = sameShape(s.c, c) ? 0.25 : 1; // sliding a chord shape is one movement
          const t = s.cost + (d ? slide * time * (w.shiftBase + w.shift * d) : 0) + w.cross * x + w.skip * Math.max(0, x - 1);
          if (t < best) { best = t; prev = s; }
        }
        next.push({ c, p, m, cost: best + ic, prev });
      }
    }
    layer = next;
  });
  let end = layer.reduce((a, b) => (b.cost < a.cost ? b : a));
  const cost = end.cost;
  const out = [];
  for (; end; end = end.prev) out.push(end.c);
  return { beats: out.reverse(), cost: Math.round(cost * 10) / 10 };
}
