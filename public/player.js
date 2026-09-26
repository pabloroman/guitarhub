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

// Heroicons 20/solid (MIT, Tailwind Labs), inlined
const icon = d => `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="${d}"/></svg>`;
const ICONS = {
  play: icon('M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.841Z'),
  pause: icon('M5.75 3a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75A.75.75 0 0 0 7.25 3h-1.5ZM12.75 3a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75a.75.75 0 0 0-.75-.75h-1.5Z'),
  stop: icon('M5.25 3A2.25 2.25 0 0 0 3 5.25v9.5A2.25 2.25 0 0 0 5.25 17h9.5A2.25 2.25 0 0 0 17 14.75v-9.5A2.25 2.25 0 0 0 14.75 3h-9.5Z'),
  loop: icon('M10 4.5c1.215 0 2.417.055 3.604.162a.68.68 0 0 1 .615.597c.124 1.038.208 2.088.25 3.15l-1.689-1.69a.75.75 0 0 0-1.06 1.061l2.999 3a.75.75 0 0 0 1.06 0l3.001-3a.75.75 0 1 0-1.06-1.06l-1.748 1.747a41.31 41.31 0 0 0-.264-3.386 2.18 2.18 0 0 0-1.97-1.913 41.512 41.512 0 0 0-7.477 0 2.18 2.18 0 0 0-1.969 1.913 41.16 41.16 0 0 0-.16 1.61.75.75 0 1 0 1.495.12c.041-.52.093-1.038.154-1.552a.68.68 0 0 1 .615-.597A40.012 40.012 0 0 1 10 4.5ZM5.281 9.22a.75.75 0 0 0-1.06 0l-3.001 3a.75.75 0 1 0 1.06 1.06l1.748-1.747c.042 1.141.13 2.27.264 3.386a2.18 2.18 0 0 0 1.97 1.913 41.533 41.533 0 0 0 7.477 0 2.18 2.18 0 0 0 1.969-1.913c.064-.534.117-1.071.16-1.61a.75.75 0 1 0-1.495-.12c-.041.52-.093 1.037-.154 1.552a.68.68 0 0 1-.615.597 40.013 40.013 0 0 1-7.208 0 .68.68 0 0 1-.615-.597 39.785 39.785 0 0 1-.25-3.15l1.689 1.69a.75.75 0 0 0 1.06-1.061l-2.999-3Z'),
  note: icon('M17.721 1.599a.75.75 0 0 1 .279.583v11.29a2.25 2.25 0 0 1-1.774 2.2l-2.041.44a2.216 2.216 0 0 1-.938-4.332l2.662-.577a.75.75 0 0 0 .591-.733V6.112l-8 1.73v7.684a2.25 2.25 0 0 1-1.774 2.2l-2.042.44a2.216 2.216 0 1 1-.935-4.331l2.659-.573A.75.75 0 0 0 7 12.529V4.236a.75.75 0 0 1 .591-.733l9.5-2.054a.75.75 0 0 1 .63.15Z'),
  clock: icon('M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z'),
  printer: icon('M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v3.552c.377.046.752.097 1.126.153A2.212 2.212 0 0 1 18 8.653v4.097A2.25 2.25 0 0 1 15.75 15h-.241l.305 1.984A1.75 1.75 0 0 1 14.084 19H5.915a1.75 1.75 0 0 1-1.73-2.016L4.492 15H4.25A2.25 2.25 0 0 1 2 12.75V8.653c0-1.082.775-2.034 1.874-2.198.374-.056.75-.107 1.127-.153L5 6.25v-3.5Zm8.5 3.397a41.533 41.533 0 0 0-7 0V2.75a.25.25 0 0 1 .25-.25h6.5a.25.25 0 0 1 .25.25v3.397ZM6.608 12.5a.25.25 0 0 0-.247.212l-.693 4.5a.25.25 0 0 0 .247.288h8.17a.25.25 0 0 0 .246-.288l-.692-4.5a.25.25 0 0 0-.247-.212H6.608Z'),
};

// Mounts an alphaTab viewer + player into `root` (expects .at-controls and .at-score inside).
export function createPlayer(root) {
  const scoreEl = root.querySelector('.at-score');
  const api = new alphaTab.AlphaTabApi(scoreEl, {
    core: { fontDirectory: '/vendor/font/' },
    display: { layoutMode: 'Page', scale: 0.9, resources: { barNumberColor: '#7a7d85' } }, // alphaTab's default is red
    player: {
      playerMode: 'EnabledSynthesizer',
      soundFont: '/vendor/soundfont/sonivox.sf2',
      scrollElement: root.querySelector('.at-scroll') ?? 'html',
      enableUserInteraction: true, // click to seek, drag to select a loop range
    },
  });

  const c = root.querySelector('.at-controls');
  c.innerHTML = `
    <button class="play icon" disabled aria-label="Play">${ICONS.play}</button>
    <button class="stop icon" disabled aria-label="Stop">${ICONS.stop}</button>
    <label class="speed-l"><span class="muted">Speed</span> <input class="speed" type="range" min="25" max="150" step="5" value="100"> <output class="speed-out">100%</output></label>
    <button class="toggle loop" aria-pressed="false">${ICONS.loop} Loop</button>
    <button class="toggle metro" aria-pressed="false">${ICONS.note} Metronome</button>
    <button class="toggle countin" aria-pressed="false">${ICONS.clock} Count-in</button>
    <button class="print" disabled>${ICONS.printer} Print</button>
    <span class="status muted">Loading sound…</span>`;
  const $ = s => c.querySelector(s);
  // Auto-scroll puts the current bar at the viewport top; keep it below the sticky controls (height changes when they wrap).
  new ResizeObserver(() => { api.settings.player.scrollOffsetY = -c.offsetHeight - 8; }).observe(c);

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
    $('.status').textContent = ''; // keeps the bar on one row
    c.title = 'Tip: drag across bars to loop them';
  });
  api.playerStateChanged.on(e => {
    const playing = e.state === 1;
    $('.play').innerHTML = playing ? ICONS.pause : ICONS.play;
    $('.play').ariaLabel = playing ? 'Pause' : 'Play';
  });
  api.scoreLoaded.on(score => { tempos = barTempos(score); $('.print').disabled = false; showSpeed(); });
  api.playbackRangeChanged.on(showSpeed);
  $('.play').onclick = () => api.playPause();
  $('.stop').onclick = () => api.stop();
  $('.speed').oninput = e => { api.playbackSpeed = e.target.value / 100; showSpeed(); };
  const toggle = (sel, set) => {
    $(sel).onclick = () => { const on = $(sel).ariaPressed !== 'true'; $(sel).ariaPressed = on; set(on); };
  };
  toggle('.loop', on => { api.isLooping = on; });
  toggle('.metro', on => { api.metronomeVolume = on ? 1 : 0; });
  toggle('.countin', on => { api.countInVolume = on ? 1 : 0; });
  // alphaTab opens an A4-sized popup with the current track(s) and calls the browser's print dialog
  $('.print').onclick = () => api.print();

  api.setSpeed = pct => { api.playbackSpeed = pct / 100; showSpeed(); };
  api.speedPct = () => Math.round(api.playbackSpeed * 100);
  // tempo in bpm instead of percent (tutor's tempo ladder, practice log)
  api.setBpm = bpm => { if (api.score) api.setSpeed((bpm / baseTempo()) * 100); };
  api.currentBpm = () => (api.score ? Math.round(baseTempo() * api.playbackSpeed) : null);
  api.setLooping = on => { api.isLooping = on; $('.loop').ariaPressed = on; };
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
