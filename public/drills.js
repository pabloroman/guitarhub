// Built-in technique drills. Each level is a 2-bar loop; reaching a level's target_bpm unlocks the next one.
// Notes are fret.string (string 1 = high E), `*n` repeats a beat, {pm} = palm mute, {h} = hammer-on/pull-off to the next note.
const tex = body => `\\track "Guitar" \\staff {tabs} \\tuning (E4 B3 G3 D3 A2 E2)\n${body}`;
const gallop = (...chords) => chords.map(c => `:8 ${c} :16 ${c} ${c}`).join(' ');        // 8th + two 16ths
const reverse = (...chords) => chords.map(c => `:16 ${c} ${c} :8 ${c}`).join(' ');       // two 16ths + 8th
const pm = (...notes) => `(${notes.map(n => `${n}{pm}`).join(' ')})`;
const E5 = pm('0.6', '2.5'), G5 = pm('3.6', '5.5'), A5 = pm('5.6', '7.5'), C5 = pm('8.6', '10.5'), D5 = pm('10.6', '12.5');

export const DRILLS = [
  {
    key: 'tremolo', name: 'Tremolo picking',
    levels: [
      { title: '8ths on one note', goal: 'Even alternate picking from the wrist, pick barely clearing the string.',
        alphatex: tex(':8 5.2*8 | 5.2*8 |'), start_bpm: 80, target_bpm: 130 },
      { title: '16ths on one note', goal: 'Same motion, twice as many notes. Keep the arm relaxed; tension kills speed.',
        alphatex: tex(':16 5.2*16 | 5.2*16 |'), start_bpm: 70, target_bpm: 120 },
      { title: 'Moving along the string', goal: 'Keep the picking hand steady while the fretting hand shifts in time.',
        alphatex: tex(':16 5.2*8 7.2*8 | 8.2*8 7.2*8 |'), start_bpm: 70, target_bpm: 120 },
      { title: 'Changing strings', goal: 'Cross between B and high E without breaking the stream of 16ths.',
        alphatex: tex(':16 5.2*4 7.2*4 5.1*4 8.1*4 | 7.1*4 5.1*4 8.2*4 7.2*4 |'), start_bpm: 70, target_bpm: 130 },
    ],
  },
  {
    key: 'gallops', name: 'Downpicked gallops',
    levels: [
      { title: 'Open string', goal: 'All downstrokes, palm muted. The two 16ths should be as loud as the 8th.',
        alphatex: tex(`${gallop('0.6{pm}', '0.6{pm}', '0.6{pm}', '0.6{pm}')} | ${gallop('0.6{pm}', '0.6{pm}', '0.6{pm}', '0.6{pm}')} |`),
        start_bpm: 90, target_bpm: 160 },
      { title: 'Power chords', goal: 'Same gallop on two strings; keep the mute consistent on both.',
        alphatex: tex(`${gallop(E5, E5, E5, E5)} | ${gallop(E5, E5, G5, A5)} |`), start_bpm: 90, target_bpm: 150 },
      { title: 'Chord changes', goal: 'Change chord every gallop without the fretting hand falling behind.',
        alphatex: tex(`${gallop(E5, G5, A5, G5)} | ${gallop(E5, C5, D5, A5)} |`), start_bpm: 80, target_bpm: 150 },
      { title: 'Reverse gallops', goal: 'Two 16ths then the 8th: harder to keep even. Still all downstrokes.',
        alphatex: tex(`${reverse(E5, E5, G5, A5)} | ${reverse(E5, C5, D5, A5)} |`), start_bpm: 80, target_bpm: 140 },
    ],
  },
  {
    key: 'skipping', name: 'String skipping',
    levels: [
      { title: 'Low E to D in 8ths', goal: 'Skip the A string cleanly; mute it with the picking hand.',
        alphatex: tex(':8 0.6 2.4 0.6 2.4 0.6 3.4 0.6 2.4 | 0.6 5.4 0.6 3.4 0.6 2.4 0.6 3.4 |'), start_bpm: 80, target_bpm: 140 },
      { title: 'Low E to D in 16ths', goal: 'Pedal riff: open low E against a melody on the D string.',
        alphatex: tex(':16 0.6 2.4 0.6 3.4 0.6 5.4 0.6 3.4 0.6 2.4 0.6 3.4 0.6 5.4 0.6 7.4 | 0.6 5.4 0.6 3.4 0.6 2.4 0.6 3.4 0.6 2.4 0.6 0.4 0.6 2.4 0.6 3.4 |'),
        start_bpm: 70, target_bpm: 130 },
      { title: 'Skipping the G string', goal: 'D and B strings: bigger jump, lighter touch.',
        alphatex: tex(':16 7.4 5.2 7.4 6.2 7.4 5.2 7.4 8.2 7.4 5.2 7.4 6.2 7.4 8.2 7.4 6.2 | 5.4 5.2 5.4 6.2 5.4 8.2 5.4 6.2 5.4 5.2 5.4 6.2 5.4 8.2 7.4 5.2 |'), start_bpm: 70, target_bpm: 130 },
    ],
  },
  {
    key: 'bursts', name: 'Alternate-picking bursts',
    levels: [
      { title: '4-note bursts', goal: 'Rest on the quarter note, then fire four 16ths. Relax between bursts.',
        alphatex: tex(':4 5.1 :16 5.1 7.1 8.1 7.1 :4 5.1 :16 8.1 7.1 5.1 7.1 | :4 5.1 :16 5.1 7.1 8.1 7.1 :4 5.1 :16 8.1 7.1 5.1 7.1 |'),
        start_bpm: 80, target_bpm: 140 },
      { title: '8-note bursts', goal: 'Twice as long; land exactly on the beat after the burst.',
        alphatex: tex(':16 5.1 7.1 8.1 7.1 5.1 7.1 8.1 7.1 :4 5.1 r | :16 8.1 7.1 5.1 7.1 8.1 7.1 5.1 7.1 :4 8.1 r |'),
        start_bpm: 70, target_bpm: 130 },
      { title: 'Across two strings', goal: 'Three notes per string; pick through the string change.',
        alphatex: tex(':16 5.2 6.2 8.2 5.1 7.1 8.1 7.1 5.1 :4 8.2 r | :16 8.2 6.2 5.2 8.2 6.2 5.2 6.2 8.2 :4 5.1 r |'),
        start_bpm: 70, target_bpm: 130 },
      { title: 'Continuous run', goal: 'No rests: the whole scale fragment up and down in 16ths.',
        alphatex: tex(':16 5.3 7.3 9.3 6.2 8.2 10.2 7.1 8.1 10.1 8.1 7.1 10.2 8.2 6.2 9.3 7.3 | 5.3 7.3 9.3 6.2 8.2 10.2 7.1 8.1 10.1 8.1 7.1 10.2 8.2 6.2 9.3 7.3 |'),
        start_bpm: 60, target_bpm: 120 },
    ],
  },
  {
    key: 'legato', name: 'Legato runs',
    levels: [
      { title: 'Hammer-on / pull-off trill', goal: 'Pick once, then let the fretting hand do the work. Even volume.',
        alphatex: tex(':8 5.1{h} 7.1{h} 5.1{h} 7.1{h} 5.1{h} 8.1{h} 5.1{h} 8.1 | 5.1{h} 7.1{h} 5.1{h} 7.1{h} 5.1{h} 8.1{h} 7.1{h} 5.1 |'),
        start_bpm: 80, target_bpm: 140 },
      { title: 'Three-note groups', goal: 'One pick, two slurred notes, in 16ths.',
        alphatex: tex(':16 5.1{h} 7.1{h} 8.1{h} 7.1{h} 5.1{h} 7.1{h} 8.1{h} 7.1{h} 5.1{h} 7.1{h} 8.1{h} 7.1{h} 5.1{h} 7.1{h} 8.1{h} 7.1 | 5.2{h} 6.2{h} 8.2{h} 6.2{h} 5.2{h} 6.2{h} 8.2{h} 6.2{h} 5.2{h} 6.2{h} 8.2{h} 6.2{h} 5.2{h} 6.2{h} 8.2{h} 6.2 |'),
        start_bpm: 70, target_bpm: 120 },
      { title: 'Descending pentatonic', goal: 'A minor pentatonic with pull-offs, moving down the strings.',
        alphatex: tex(':16 8.1{h} 5.1 8.2{h} 5.2 7.3{h} 5.3 7.4{h} 5.4 8.1{h} 5.1 8.2{h} 5.2 7.3{h} 5.3 7.4{h} 5.4 | 8.1{h} 5.1 8.2{h} 5.2 7.3{h} 5.3 7.4{h} 5.4 7.5{h} 5.5 7.4{h} 5.4 :4 7.5 |'),
        start_bpm: 70, target_bpm: 130 },
      { title: 'Up and down the box', goal: 'Hammer-ons going up, pull-offs coming down, without a gap at the turn.',
        alphatex: tex(':16 5.4{h} 7.4 5.3{h} 7.3 5.2{h} 8.2 5.1{h} 8.1 8.1{h} 5.1 8.2{h} 5.2 7.3{h} 5.3 7.4{h} 5.4 | 5.4{h} 7.4 5.3{h} 7.3 5.2{h} 8.2 5.1{h} 8.1 8.1{h} 5.1 8.2{h} 5.2 :4 7.3 |'),
        start_bpm: 60, target_bpm: 120 },
    ],
  },
];
