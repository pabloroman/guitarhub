// Pitch classes are 0-11 from C. Strings run low to high, like optimizer.js.
export const OPEN = [40, 45, 50, 55, 59, 64];
// Scales as degrees of the major scale, so notes can be spelled for their key (Bb, not A#) and labelled (b3).
export const SCALES = {
  Major: '1 2 3 4 5 6 7', Minor: '1 2 b3 4 5 b6 b7',
  'Major pentatonic': '1 2 3 5 6', 'Minor pentatonic': '1 b3 4 5 b7', Blues: '1 b3 4 b5 5 b7',
  'Harmonic minor': '1 2 b3 4 5 b6 7',
  Dorian: '1 2 b3 4 5 6 b7', Phrygian: '1 b2 b3 4 5 b6 b7', Lydian: '1 2 3 #4 5 6 7', Mixolydian: '1 2 3 4 5 6 b7', Locrian: '1 b2 b3 4 b5 b6 b7',
};

const LETTERS = 'CDEFGAB', NATURAL = [0, 2, 4, 5, 7, 9, 11]; // the naturals' pitch classes, which are also the major scale's steps
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// each degree takes the next letter after the root's, then whatever accidental reaches its pitch
function spell(rootName, root, degrees) {
  let accidentals = 0;
  const notes = degrees.map(degree => {
    const n = degree.at(-1) - 1, pc = (root + NATURAL[n] + ({ '#': 1, b: -1 }[degree[0]] ?? 0) + 12) % 12;
    const letter = (LETTERS.indexOf(rootName[0]) + n) % 7, alter = ((pc - NATURAL[letter] + 18) % 12) - 6;
    accidentals += Math.abs(alter);
    return { pc, degree, name: LETTERS[letter] + ['bb', 'b', '', '#', 'x'][alter + 2] };
  });
  return { notes, accidentals };
}

// [{ pc, degree, name }], root first, under whichever of the root's two names needs fewer accidentals (Eb major, not D#)
export function scale(root, name) {
  const degrees = SCALES[name].split(' ');
  // five- and six-note scales take their root's name from the major or minor key they sit in (Bb blues, like Bb minor)
  const key = degrees.length === 7 ? degrees : SCALES[degrees.includes('b3') ? 'Minor' : 'Major'].split(' ');
  const rootName = [SHARP[root], FLAT[root]].sort((a, b) => spell(a, root, key).accidentals - spell(b, root, key).accidentals)[0];
  return spell(rootName, root, degrees).notes;
}

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

const QUALITY = { '4,7': 'Major', '3,7': 'Minor', '3,6': 'Diminished', '4,8': 'Augmented' };
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

// the triad on each degree of a seven-note scale; other scales don't stack into thirds, so they get none
export function chords(root, name) {
  const s = scale(root, name);
  if (s.length !== 7) return [];
  return s.map((r, i) => {
    const notes = [r, s[(i + 2) % 7], s[(i + 4) % 7]].map(n => n.pc);
    const quality = QUALITY[notes.slice(1).map(n => (n - r.pc + 12) % 12)];
    const numeral = quality === 'Major' || quality === 'Augmented' ? NUMERALS[i] : NUMERALS[i].toLowerCase();
    return { root: r.pc, name: r.name, quality, notes, frets: shape(r.pc, quality),
      numeral: r.degree.slice(0, -1) + numeral + ({ Diminished: '°', Augmented: '+' }[quality] ?? '') };
  });
}
