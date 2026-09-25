import * as alphaTab from '/vendor/alphaTab.mjs';
export { alphaTab };

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = midi => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
// staff.tuning is highest string first; show it low -> high like guitarists say it ("D A D G B E")
export const tuningLabel = staff => staff.tuningName || [...staff.tuning].reverse().map(m => NAMES[m % 12]).join(' ');

// Guitar and bass tracks only: Guitar Pro stores keys, organ, synths etc. as 6-string tracks too.
// General MIDI programs 24-31 are guitars, 32-39 basses.
const isStringTrack = t => t.staves[0].isStringed && !t.staves[0].isPercussion;
export const isGuitar = t => isStringTrack(t) && t.playbackInfo.program >= 24 && t.playbackInfo.program <= 39;
// Falls back to every stringed track so a tab with odd instrument numbers never ends up with none.
export const guitarTracks = score => {
  const g = score.tracks.filter(isGuitar);
  return g.length ? g : score.tracks.filter(isStringTrack);
};

// Tempo of every bar (bpm), carrying tempo changes forward.
// ponytail: only a tempo change at the start of a bar counts, not mid-bar ones.
export function barTempos(score) {
  let tempo = score.tempo;
  return score.masterBars.map(mb => (tempo = mb.tempoAutomations[0]?.value ?? tempo));
}

// Mounts an alphaTab viewer + player into `root` (expects .at-controls and .at-score inside).
export function createPlayer(root) {
  const scoreEl = root.querySelector('.at-score');
  const api = new alphaTab.AlphaTabApi(scoreEl, {
    core: { fontDirectory: '/vendor/font/' },
    display: { layoutMode: 'Page', scale: 0.9 },
    player: {
      playerMode: 'EnabledSynthesizer',
      soundFont: '/vendor/soundfont/sonivox.sf2',
      scrollElement: root.querySelector('.at-scroll') ?? 'html',
      enableUserInteraction: true, // click to seek, drag to select a loop range
    },
  });

  const c = root.querySelector('.at-controls');
  c.innerHTML = `
    <button class="play" disabled aria-label="Play">▶</button>
    <button class="stop" disabled aria-label="Stop">■</button>
    <label>Speed <input class="speed" type="range" min="25" max="150" step="5" value="100"> <output class="speed-out">100%</output></label>
    <label><input class="loop" type="checkbox"> Loop</label>
    <label><input class="metro" type="checkbox"> Metronome</label>
    <label><input class="countin" type="checkbox"> Count-in</label>
    <button class="print" disabled>Print</button>
    <span class="status muted">Loading sound…</span>`;
  const $ = s => c.querySelector(s);

  // Tempo of the passage being played: the bar where the loop selection starts (bar 1 without one).
  let tempos = [];
  const baseTempo = () => {
    const r = api.playbackRange;
    const bar = r ? api.score.masterBars.filter(m => m.start <= r.startTick).at(-1).index : 0;
    return tempos[bar] ?? api.score.tempo;
  };
  const showSpeed = () => {
    const pct = Math.round(api.playbackSpeed * 100);
    const bpm = api.score ? Math.round(baseTempo() * api.playbackSpeed) : '';
    $('.speed').value = pct;
    $('.speed-out').textContent = `${pct}%${bpm ? ` · ${bpm} bpm` : ''}`;
  };
  api.soundFontLoad.on(e => { $('.status').textContent = `Loading sound… ${Math.floor((e.loaded / e.total) * 100)}%`; });
  api.playerReady.on(() => {
    $('.play').disabled = $('.stop').disabled = false;
    $('.status').textContent = 'Drag across the tab to select a loop range';
  });
  api.playerStateChanged.on(e => { $('.play').textContent = e.state === 1 ? '❚❚' : '▶'; });
  api.scoreLoaded.on(score => { tempos = barTempos(score); $('.print').disabled = false; showSpeed(); });
  api.playbackRangeChanged.on(showSpeed);
  $('.play').onclick = () => api.playPause();
  $('.stop').onclick = () => api.stop();
  $('.speed').oninput = e => { api.playbackSpeed = e.target.value / 100; showSpeed(); };
  $('.loop').onchange = e => { api.isLooping = e.target.checked; };
  $('.metro').onchange = e => { api.metronomeVolume = e.target.checked ? 1 : 0; };
  $('.countin').onchange = e => { api.countInVolume = e.target.checked ? 1 : 0; };
  // alphaTab opens an A4-sized popup with the current track(s) and calls the browser's print dialog
  $('.print').onclick = () => api.print();

  api.setSpeed = pct => { api.playbackSpeed = pct / 100; showSpeed(); };
  api.speedPct = () => Math.round(api.playbackSpeed * 100);
  // tempo in bpm instead of percent (tutor's tempo ladder, practice log)
  api.setBpm = bpm => { if (api.score) api.setSpeed((bpm / baseTempo()) * 100); };
  api.currentBpm = () => (api.score ? Math.round(baseTempo() * api.playbackSpeed) : null);
  api.setLooping = on => { api.isLooping = on; $('.loop').checked = on; };
  return api;
}

// Compact alphaTex for bars [from, to] (1-based) of a staff — fed to the tutor as the "problem passage".
export function barsToTex(staff, from, to) {
  const n = staff.tuning.length;
  const bars = staff.bars.slice(from - 1, to).map(bar => bar.voices[0].beats.map(b => {
    const fx = [b.dots ? 'd' : '', b.tupletNumerator > 1 ? `tu ${b.tupletNumerator}` : '', b.tremoloSpeed ? `tp ${b.tremoloSpeed / 2}` : '']
      .filter(Boolean).join(' ');
    const dur = `.${b.duration}${fx ? `{${fx}}` : ''}`;
    if (b.isRest || !b.notes.length) return `r${dur}`;
    const notes = b.notes.map(nt => `${nt.fret}.${n + 1 - nt.string}${nt.isPalmMute ? '{pm}' : ''}`);
    return (notes.length > 1 ? `(${notes.join(' ')})` : notes[0]) + dur;
  }).join(' '));
  return `\\tuning (${staff.tuning.map(noteName).join(' ')})\n${bars.join(' |\n')}`;
}
