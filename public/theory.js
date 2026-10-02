// Pitch classes are 0-11 from C. Strings run low to high, like optimizer.js.
export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const SCALES = { Major: [0, 2, 4, 5, 7, 9, 11], Minor: [0, 2, 3, 5, 7, 8, 10] };
export const OPEN = [40, 45, 50, 55, 59, 64];

export const scaleNotes = (root, scale) => SCALES[scale].map(s => (root + s) % 12);

const X = -1; // muted string
// the open chords that aren't a barre shape slid down to the nut, keyed by root + quality
const OPEN_SHAPES = { '0Major': [X, 3, 2, 0, 1, 0], '2Major': [X, X, 0, 2, 3, 2], '7Major': [3, 2, 0, 0, 0, 3], '2Minor': [X, X, 0, 2, 3, 1] };
// movable shapes: [pitch class of the open string the root sits on, frets relative to the root's fret]
const MOVABLE = {
  Major: [[4, [0, 2, 2, 1, 0, 0]], [9, [X, 0, 2, 2, 2, 0]]],
  Minor: [[4, [0, 2, 2, 0, 0, 0]], [9, [X, 0, 2, 2, 1, 0]]],
  Diminished: [[9, [X, 0, 1, 2, 1, X]], [2, [X, X, 0, 1, 3, 1]]],
};

// one fret per string, -1 for muted: an open chord if there is one, else whichever movable shape sits lower on the neck
export function shape(root, quality) {
  if (OPEN_SHAPES[root + quality]) return OPEN_SHAPES[root + quality];
  const [n, frets] = MOVABLE[quality].map(([open, frets]) => [(root - open + 12) % 12, frets]).sort((a, b) => a[0] - b[0])[0];
  return frets.map(f => f === X ? X : n + f);
}

const QUALITY = { '4,7': 'Major', '3,7': 'Minor', '3,6': 'Diminished' };

// the triad on each degree of the scale
export function chords(root, scale) {
  const s = scaleNotes(root, scale);
  return s.map((r, i) => {
    const notes = [r, s[(i + 2) % 7], s[(i + 4) % 7]];
    const quality = QUALITY[notes.slice(1).map(n => (n - r + 12) % 12)];
    return { root: r, quality, notes, frets: shape(r, quality) };
  });
}
