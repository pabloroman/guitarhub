// Pitch classes are 0-11 from C. Strings run low to high, like optimizer.js.
export const OPEN = [40, 45, 50, 55, 59, 64];
export const TUNINGS = {
  Standard: OPEN, 'Eb standard': [39, 44, 49, 54, 58, 63], 'D standard': [38, 43, 48, 53, 57, 62],
  'Drop D': [38, 45, 50, 55, 59, 64], 'Drop C': [36, 43, 48, 53, 57, 62],
  DADGAD: [38, 45, 50, 55, 57, 62], 'Open G': [38, 43, 50, 55, 59, 62], 'Open D': [38, 45, 50, 54, 57, 62],
};
// Scales as degrees of the major scale, so notes can be spelled for their key (Bb, not A#) and labelled (b3).
export const SCALES = {
  Major: '1 2 3 4 5 6 7', Minor: '1 2 b3 4 5 b6 b7',
  'Major pentatonic': '1 2 3 5 6', 'Minor pentatonic': '1 b3 4 5 b7', Blues: '1 b3 4 b5 5 b7',
  'Harmonic minor': '1 2 b3 4 5 b6 7',
  Dorian: '1 2 b3 4 5 6 b7', Phrygian: '1 b2 b3 4 5 b6 b7', Lydian: '1 2 3 #4 5 6 7', Mixolydian: '1 2 3 4 5 6 b7', Locrian: '1 b2 b3 4 b5 b6 b7',
};

// Chord types the same way, plus the symbol written after the root (Cmaj7).
export const CHORD_TYPES = {
  Major: { symbol: '', degrees: '1 3 5' }, Minor: { symbol: 'm', degrees: '1 b3 5' },
  Diminished: { symbol: 'dim', degrees: '1 b3 b5' }, Augmented: { symbol: 'aug', degrees: '1 3 #5' },
  'Suspended 2nd': { symbol: 'sus2', degrees: '1 2 5' }, 'Suspended 4th': { symbol: 'sus4', degrees: '1 4 5' },
  'Major 6th': { symbol: '6', degrees: '1 3 5 6' }, 'Minor 6th': { symbol: 'm6', degrees: '1 b3 5 6' },
  'Dominant 7th': { symbol: '7', degrees: '1 3 5 b7' }, 'Major 7th': { symbol: 'maj7', degrees: '1 3 5 7' }, 'Minor 7th': { symbol: 'm7', degrees: '1 b3 5 b7' },
  'Half-diminished': { symbol: 'm7b5', degrees: '1 b3 b5 b7' }, 'Diminished 7th': { symbol: 'dim7', degrees: '1 b3 b5 bb7' },
  'Added 9th': { symbol: 'add9', degrees: '1 3 5 9' }, 'Dominant 9th': { symbol: '9', degrees: '1 3 5 b7 9' },
};

const LETTERS = 'CDEFGAB', NATURAL = [0, 2, 4, 5, 7, 9, 11]; // the naturals' pitch classes, which are also the major scale's steps
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// each degree takes the next letter after the root's, then whatever accidental reaches its pitch
function spell(rootName, root, degrees) {
  let accidentals = 0;
  const notes = degrees.map(degree => {
    const n = (parseInt(degree.replace(/[#b]/g, '')) - 1) % 7, sharps = degree.split('#').length - degree.split('b').length; // 9 is 2 an octave up
    const pc = (root + NATURAL[n] + sharps + 12) % 12;
    const letter = (LETTERS.indexOf(rootName[0]) + n) % 7, alter = ((pc - NATURAL[letter] + 18) % 12) - 6;
    accidentals += Math.abs(alter);
    return { pc, degree, name: LETTERS[letter] + ['bb', 'b', '', '#', 'x'][alter + 2] };
  });
  return { notes, accidentals };
}

// [{ pc, degree, name }], root first, under whichever of the root's two names needs fewer accidentals (Eb major, not D#)
function named(root, degrees) {
  // chords and five- and six-note scales take their root's name from the major or minor key they sit in (Bb blues, like Bb minor)
  const key = degrees.length === 7 ? degrees : SCALES[degrees.includes('b3') ? 'Minor' : 'Major'].split(' ');
  const rootName = [SHARP[root], FLAT[root]].sort((a, b) => spell(a, root, key).accidentals - spell(b, root, key).accidentals)[0];
  return spell(rootName, root, degrees).notes;
}
export const scale = (root, name) => named(root, SCALES[name].split(' '));
export const chord = (root, type) => named(root, CHORD_TYPES[type].degrees.split(' '));

// A scale's hand positions, each [{ string, fret }] in rising pitch (string 0 is the lowest), starting with the one
// whose lowest note is the root. A position walks up the scale from one of its notes on the lowest string, a fixed
// number of notes per string: 3 for seven-note scales, 2 for pentatonics.
export function positions(open, notes, maxFret = 17) {
  // Blues is its pentatonic box plus the b5s inside the box
  const blue = notes.length === 6 && notes.find(n => n.degree === 'b5');
  const pcs = notes.filter(n => n !== blue).map(n => n.pc), per = pcs.length === 7 ? 3 : 2;
  return pcs.map(first => {
    const pitches = [];
    for (let p = open[0] + (first - open[0] % 12 + 12) % 12; pitches.length < per * open.length; p++) if (pcs.includes(p % 12)) pitches.push(p);
    let out = pitches.map((p, i) => ({ string: Math.floor(i / per), fret: p - open[Math.floor(i / per)] }));
    // a box that would start behind the nut is played an octave up
    if (out.some(n => n.fret < 0)) out = out.map(n => ({ ...n, fret: n.fret + 12 }));
    if (blue) {
      const frets = out.map(n => n.fret);
      open.forEach((o, string) => { for (let fret = Math.min(...frets); fret <= Math.max(...frets); fret++) if ((o + fret) % 12 === blue.pc) out.push({ string, fret }); });
      out.sort((a, b) => open[a.string] + a.fret - open[b.string] - b.fret);
    }
    return out;
  }).filter(p => p.every(n => n.fret <= maxFret)); // drop one that runs off the end of the neck
}

// The five CAGED positions of a scale, in the same form as positions() and in the order E, D, C, A, G shape.
// The hand stays in a four-fret window that starts on a note of the key's pentatonic on the lowest string, and the
// first finger reaches back one fret where the scale needs it. A window at the nut starts at fret 1 and reaches the open strings.
export function caged(open, notes, maxFret = 17) {
  const pcs = notes.map(n => n.pc), minor = notes.some(n => n.degree === 'b3');
  return scale(notes[0].pc, minor ? 'Minor pentatonic' : 'Major pentatonic').map(anchor => {
    const first = (anchor.pc - open[0] % 12 + 12) % 12 || 1, out = [];
    let pitch = open[0] + first - 1;
    open.forEach((o, string) => {
      // every scale note up to the end of the window; the next one starts the following string
      for (; pitch - o <= first + 3; pitch++) if (pcs.includes(pitch % 12)) out.push({ string, fret: pitch - o });
    });
    return out.some(n => n.fret < 0) ? out.map(n => ({ ...n, fret: n.fret + 12 })) : out;
  }).filter(p => p.every(n => n.fret <= maxFret));
}

// a pitch class under both its names where it has two: "C#/Db"
export const pitchClassName = pc => SHARP[pc] === FLAT[pc] ? SHARP[pc] : `${SHARP[pc]}/${FLAT[pc]}`;
// "Drop D", or the open strings' notes for a tuning without a name ("C G C F A D")
export const tuningName = open => Object.keys(TUNINGS).find(t => TUNINGS[t].join() === open.join()) ?? open.map(m => SHARP[m % 12]).join(' ');

const X = -1; // muted string
// the open chords that aren't a barre shape slid down to the nut, keyed by root + quality
const OPEN_SHAPES = { '0Major': [X, 3, 2, 0, 1, 0], '2Major': [X, X, 0, 2, 3, 2], '7Major': [3, 2, 0, 0, 0, 3], '2Minor': [X, X, 0, 2, 3, 1] };
// movable shapes: [pitch class of the open string the root sits on, frets relative to the root's fret]
const MOVABLE = {
  Major: [[4, [0, 2, 2, 1, 0, 0]], [9, [X, 0, 2, 2, 2, 0]]],
  Minor: [[4, [0, 2, 2, 0, 0, 0]], [9, [X, 0, 2, 2, 1, 0]]],
  Diminished: [[9, [X, 0, 1, 2, 1, X]], [2, [X, X, 0, 1, 3, 1]]],
  Augmented: [[4, [0, 3, 2, 1, 1, 0]], [9, [X, 0, 3, 2, 2, 1]]],
};

// one fret per string, -1 for muted: an open chord if there is one, else whichever movable shape sits lower on the neck
export function shape(root, quality) {
  if (OPEN_SHAPES[root + quality]) return OPEN_SHAPES[root + quality];
  const [n, frets] = MOVABLE[quality].map(([open, frets]) => [(root - open + 12) % 12, frets]).sort((a, b) => a[0] - b[0])[0];
  return frets.map(f => f === X ? X : n + f);
}

// Ways to play a chord as [{ frets, low, cost }], one per place on the neck: `frets` is one fret per string (-1 for
// muted), `low` the lowest fretted fret, `cost` how awkward it is (lower is easier).
// ponytail: "playable" here is a rule of thumb (root in the bass, one four-fret hand span, four fingers with a barre,
// open strings only near the nut). It finds the textbook shapes but can't judge an awkward stretch, and it skips
// voicings with a muted string in the middle. If it suggests bad ones, curate fingerings per chord instead.
function search(open, root, type) {
  const tones = chord(root, type).map(n => n.pc);
  const needed = tones.length > 3 ? tones.filter((_, i) => i !== 2) : tones; // the 5th is the note bigger chords can do without
  const best = new Map(); // lowest fretted fret -> the easiest, fullest voicing there
  const consider = frets => {
    const first = frets.findIndex(f => f !== X), last = frets.findLastIndex(f => f !== X), sounding = frets.slice(first, last + 1);
    if (sounding.length < 4 || sounding.includes(X)) return; // four strings or more, next to each other
    const pcs = sounding.map((f, i) => (open[first + i] + f) % 12);
    if (pcs[0] !== root || !needed.every(pc => pcs.includes(pc))) return;
    const fretted = frets.filter(f => f > 0), low = fretted.length ? Math.min(...fretted) : 0;
    // a finger per fretted note, except that a barre takes all the notes at the lowest fret when no open string rings between them
    const atLow = fretted.filter(f => f === low).length, barre = atLow > 1 && !frets.slice(frets.indexOf(low), frets.lastIndexOf(low)).includes(0);
    const fingers = fretted.length - (barre ? atLow - 1 : 0), stretch = fretted.length ? Math.max(...fretted) - low : 0;
    // fewer fingers and less stretch beat more strings; between equals, the one without open strings (a movable shape)
    const cost = fingers * 2 + stretch * 2 - sounding.length * 3 + frets.filter(f => f === 0).length * .1;
    if (fingers <= 4 && low < 12 && !(best.get(low)?.cost <= cost)) best.set(low, { frets, low, cost }); // from the 12th fret the shapes repeat
  };
  for (let base = 1; base < 12; base++) {
    const options = open.map(o => [X, ...(base === 1 ? [0] : []), base, base + 1, base + 2, base + 3].filter(f => f === X || tones.includes((o + f) % 12)));
    const walk = frets => frets.length < open.length ? options[frets.length].forEach(f => walk([...frets, f])) : consider(frets);
    walk([]);
  }
  return [...best.values()];
}
// the standard shape in standard tuning; in any other, the easiest voicing the search finds, leaning towards the nut
// (all strings muted if it finds none)
const nearNut = v => v.cost + v.low * .75;
const triad = (open, root, quality) => open.join() === OPEN.join() ? shape(root, quality)
  : search(open, root, quality).sort((a, b) => nearNut(a) - nearNut(b))[0]?.frets ?? open.map(() => X);
// the six easiest, from the nut upwards
export const voicings = (open, root, type) => search(open, root, type).sort((a, b) => a.cost - b.cost).slice(0, 6).sort((a, b) => a.low - b.low).map(v => v.frets);

const QUALITY = { '4,7': 'Major', '3,7': 'Minor', '3,6': 'Diminished', '4,8': 'Augmented' };
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

// the triad on each degree of a seven-note scale; other scales don't stack into thirds, so they get none
export function chords(root, name, open = OPEN) {
  const s = scale(root, name);
  if (s.length !== 7) return [];
  return s.map((r, i) => {
    const notes = [r, s[(i + 2) % 7], s[(i + 4) % 7]].map(n => n.pc);
    const quality = QUALITY[notes.slice(1).map(n => (n - r.pc + 12) % 12)];
    const numeral = quality === 'Major' || quality === 'Augmented' ? NUMERALS[i] : NUMERALS[i].toLowerCase();
    return { root: r.pc, name: r.name, quality, notes, frets: triad(open, r.pc, quality), symbol: r.name + CHORD_TYPES[quality].symbol,
      numeral: r.degree.slice(0, -1) + numeral + ({ Diminished: '°', Augmented: '+' }[quality] ?? '') };
  });
}

// ---------- tab (alphaTex) for the player ----------

const pitchName = m => SHARP[m % 12] + (Math.floor(m / 12) - 1);
// the track header every generated tab starts with; alphaTex counts strings from the highest
export const tabTex = (open, body) => `\\track "Guitar" \\staff {tabs} \\tuning (${[...open].reverse().map(pitchName).join(' ')})\n${body}`;

// a position up and back down in 8th notes, resting out the last bar
export function scaleTex(open, position) {
  const run = [...position, ...position.slice(0, -1).reverse()].map(n => `${n.fret}.${open.length - n.string}`);
  while (run.length % 8) run.push('r');
  return `\\tempo 90\n${tabTex(open, `:8 ${run.map((n, i) => (i + 1) % 8 ? n : `${n} |`).join(' ')}`)}`;
}

// one bar per chord ({ frets, symbol }), strummed 1, 2 or 4 times, with the chord's symbol above it
export const chordsTex = (open, chords, strums = 4) => `\\tempo 90\n${tabTex(open, chords.map(c => {
  const notes = c.frets.flatMap((f, s) => f < 0 ? [] : `${f}.${open.length - s}`), beat = notes.length ? `(${notes.join(' ')})` : 'r';
  return `:${strums} ${beat}{ch "${c.symbol}"} ${`${beat} `.repeat(strums - 1)}|`;
}).join(' '))}`;

// chord progressions as degrees of the key (0 is the tonic), for keys with a major and with a minor tonic chord
const BLUES = { name: '12-bar blues', degrees: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4] };
export const PROGRESSIONS = {
  Major: [{ degrees: [0, 4, 5, 3] }, { degrees: [0, 3, 4] }, { degrees: [1, 4, 0] }, BLUES],
  Minor: [{ degrees: [0, 5, 2, 6] }, { degrees: [0, 3, 4] }, { degrees: [0, 6, 5, 4] }, BLUES],
};

// ---------- key of a piece ----------

// How strongly each degree is heard as belonging to a major or minor key (Krumhansl & Kessler's probe-tone profiles), tonic first.
const PROFILE = {
  Major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  Minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
};
const correlation = (a, b) => {
  const mean = v => v.reduce((t, x) => t + x, 0) / v.length, ma = mean(a), mb = mean(b);
  const dot = (u, mu, v, mv) => u.reduce((t, x, i) => t + (x - mu) * (v[i] - mv), 0);
  return dot(a, ma, b, mb) / Math.sqrt(dot(a, ma, a, ma) * dot(b, mb, b, mb));
};
// The key whose profile best matches how long each pitch class sounds in a piece: weights[pc] -> { root, scale }.
// ponytail: major or minor only, so a modal riff (E Phrygian) comes back as its nearest relative (A minor or C major),
// and one key for the whole piece. Add mode profiles, or a guess per section, if that turns out to matter.
export function guessKey(weights) {
  let best;
  for (const scale in PROFILE) for (let root = 0; root < 12; root++) {
    const fit = correlation(weights.map((_, i) => weights[(i + root) % 12]), PROFILE[scale]);
    if (!(best?.fit >= fit)) best = { root, scale, fit };
  }
  return best;
}
