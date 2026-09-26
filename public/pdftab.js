// Reads Guitar Pro PDF exports (tab + standard notation) back into alphaTex.
// Works on the vector drawing the PDF contains, not on pixels: fret numbers are text, and the
// staff lines, noteheads, stems, beams and bar lines are paths. pdf.js is passed in so the same code
// runs in the browser and in node tests.

const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

// Everything on a page in top-down coordinates (y grows downwards, like the rendered page).
export async function extractPage(pdfjs, page) {
  const OPS = pdfjs.OPS;
  const vt = page.getViewport({ scale: 1 }).transform;
  const ol = await page.getOperatorList();

  const paths = [], texts = [];
  let ctm = [1, 0, 0, 1, 0, 0], lw = 1;
  const stack = [];
  const paintOf = { [OPS.fill]: 'fill', [OPS.eoFill]: 'fill', [OPS.stroke]: 'stroke', [OPS.closeStroke]: 'stroke',
    [OPS.fillStroke]: 'fill', [OPS.eoFillStroke]: 'fill', [OPS.closeFillStroke]: 'fill', [OPS.closeEOFillStroke]: 'fill' };
  // Text is read from the drawing commands too: pdf.js' getTextContent() merges neighbouring
  // numbers ("12 12 12 12 8"), while Guitar Pro writes every fret number as its own text command.
  let tm = [1, 0, 0, 1, 0, 0], tlm = tm, font = null, fontSize = 1, charSp = 0, wordSp = 0, hScale = 1, leading = 0;
  const moveText = (tx, ty) => { tlm = mul(tlm, [1, 0, 0, 1, tx, ty]); tm = tlm; };
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i], args = ol.argsArray[i];
    if (fn === OPS.save) stack.push([ctm, lw]);
    else if (fn === OPS.restore) [ctm, lw] = stack.pop() ?? [ctm, lw];
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.setLineWidth) lw = args[0];
    else if (fn === OPS.beginText) tm = tlm = [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.setTextMatrix) tm = tlm = Array.from(args[0] ?? args);
    else if (fn === OPS.moveText) moveText(args[0], args[1]);
    else if (fn === OPS.setLeadingMoveText) { leading = -args[1]; moveText(args[0], args[1]); }
    else if (fn === OPS.nextLine) moveText(0, -leading);
    else if (fn === OPS.setLeading) leading = args[0];
    else if (fn === OPS.setCharSpacing) charSp = args[0];
    else if (fn === OPS.setWordSpacing) wordSp = args[0];
    else if (fn === OPS.setHScale) hScale = args[0] / 100;
    else if (fn === OPS.setFont) {
      fontSize = args[1];
      try { font = page.commonObjs.get(args[0]); } catch { font = null; }
    } else if (fn === OPS.showText || fn === OPS.showSpacedText) {
      const glyphs = args[0];
      const scale = (font?.fontMatrix?.[0] ?? 0.001) * fontSize;
      const m = mul(vt, mul(ctm, tm));
      let adv = 0, str = '';
      for (const gl of glyphs) {
        if (typeof gl === 'number') { adv -= gl * fontSize * 0.001 * hScale; continue; }
        if (!gl) continue;
        str += gl.unicode;
        adv += (gl.width * scale + charSp + (gl.isSpace ? wordSp : 0)) * hScale;
      }
      tm = mul(tm, [1, 0, 0, 1, adv, 0]);
      if (!str.trim()) continue;
      const size = Math.hypot(m[2], m[3]) * fontSize;
      const w = adv * Math.hypot(m[0], m[1]);
      texts.push({ str: str.trim(), x: m[4], y: m[5], w, size, rotated: Math.abs(m[1]) > 0.01 * Math.abs(m[0] || 1), font: font?.name ?? '' });
    } else if (fn === OPS.constructPath) {
      const paint = paintOf[args[0]];
      if (!paint) continue;
      const m = mul(vt, ctm);
      const data = args[1][0];
      if (!data) continue;
      // Strokes are split into their sub-paths (Guitar Pro draws all staff lines of a page as one path);
      // fills stay whole so a hollow notehead keeps its hole.
      const shapes = [];
      let cur = null;
      for (let j = 0; j < data.length;) {
        const op = data[j++];
        const n = op === 2 ? 3 : op === 3 ? 2 : op === 4 ? 0 : 1;
        if (!cur || (op === 0 && paint === 'stroke')) shapes.push(cur = { segs: '', pts: [] });
        cur.segs += 'mlcqh'[op];
        for (let k = 0; k < n; k++, j += 2) cur.pts.push(apply(m, data[j], data[j + 1]));
      }
      for (const { segs, pts } of shapes) {
        if (!pts.length) continue;
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        paths.push({ paint, segs, pts, lw: lw * Math.hypot(m[0], m[1]),
          x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
      }
    }
  }
  return { width: page.view[2] - page.view[0], height: page.view[3] - page.view[1], paths, texts };
}

// ---------- page layout: staves, tabs, bars ----------

const cluster = (items, key, tol) => {
  const out = [];
  for (const it of [...items].sort((a, b) => key(a) - key(b))) {
    const last = out.at(-1);
    if (last && key(it) - key(last.at(-1)) <= tol) last.push(it); else out.push([it]);
  }
  return out;
};
const avg = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const isCircle = p => p.paint === 'fill' && /^mc+h$/.test(p.segs) && Math.abs(p.x1 - p.x0 - (p.y1 - p.y0)) < (p.x1 - p.x0) * 0.15;

// Groups of evenly spaced thin horizontal lines: 5-line staves and 4–8 line tabs.
function lineGroups(pg) {
  const segs = pg.paths.filter(p => p.paint === 'stroke' && p.segs === 'ml' && p.lw < 0.6 && p.y1 - p.y0 < 0.2 && p.x1 - p.x0 > 5);
  const rows = cluster(segs, p => p.y0, 0.3)
    .map(g => ({ y: avg(g.map(p => p.y0)), x0: Math.min(...g.map(p => p.x0)), x1: Math.max(...g.map(p => p.x1)),
      len: g.reduce((s, p) => s + p.x1 - p.x0, 0) }))
    .filter(r => r.len > 60);
  const groups = [];
  for (const r of rows) {
    const g = groups.at(-1);
    const gap = g && r.y - g.rows.at(-1).y;
    const fits = g && Math.abs(r.x0 - g.rows[0].x0) < 3 && Math.abs(r.x1 - g.rows[0].x1) < 3 &&
      (g.rows.length === 1 ? gap < 16 : Math.abs(gap - g.gap) < 0.4);
    if (fits) { g.gap ??= gap; g.rows.push(r); } else groups.push({ rows: [r], gap: null });
  }
  return groups.filter(g => g.rows.length >= 4)
    .map(g => ({ ys: g.rows.map(r => r.y), gap: g.gap, x0: g.rows[0].x0, x1: g.rows[0].x1, top: g.rows[0].y, bottom: g.rows.at(-1).y }));
}

// A system is a standard-notation staff with the tab right below it (Guitar Pro's "standard + tab" layout).
function systems(pg) {
  const gs = lineGroups(pg);
  const out = [];
  for (let i = 0; i < gs.length; i++) {
    const staff = gs[i], tab = gs[i + 1];
    if (staff.ys.length !== 5 || !tab || tab.gap <= staff.gap * 1.2 || tab.top - staff.bottom > staff.gap * 12) continue;
    out.push({ staff, tab, sp: staff.gap });
    i++;
  }
  return out;
}

// Bar lines span the whole tab; repeat signs add a thick line and two dots.
function barLines(pg, sys) {
  const { tab, sp } = sys;
  const spans = p => Math.abs(p.y0 - tab.top) < 1 && Math.abs(p.y1 - tab.bottom) < 1;
  const lines = pg.paths.filter(p => spans(p) && p.x1 - p.x0 < sp * 0.7 &&
    ((p.paint === 'fill' && /^ml{3}h?$/.test(p.segs)) || (p.paint === 'stroke' && p.segs === 'ml')));
  const dots = pg.paths.filter(p => isCircle(p) && p.x1 - p.x0 < sp * 0.6 && p.y0 > tab.top && p.y1 < tab.bottom);
  return cluster(lines, p => p.x0, sp * 1.2).map(g => {
    const x0 = Math.min(...g.map(p => p.x0)), x1 = Math.max(...g.map(p => p.x1));
    return { x0, x1, x: (x0 + x1) / 2,
      closes: dots.some(d => d.x1 < x0 + 0.1 && x0 - d.x1 < sp * 0.8),
      opens: dots.some(d => d.x0 > x1 - 0.1 && d.x0 - x1 < sp * 0.8) };
  });
}

// ---------- notes and rhythm ----------

const FRET = /^(\()?(\d{1,2}|[xX])(\))?$/;
const TICKS = 3840; // whole note

// Fret numbers on the tab, grouped into beats (numbers stacked at the same x).
function tabBeats(pg, sys, x0, x1) {
  const { tab } = sys;
  const notes = pg.texts.filter(t => !t.rotated && FRET.test(t.str)).map(t => {
    const cy = t.y - t.size * 0.35, cx = t.x + t.w / 2;
    const line = tab.ys.findIndex(y => Math.abs(y - cy) < tab.gap * 0.4);
    const [, open, fret, close] = t.str.match(FRET);
    return { cx, string: line + 1, fret: /x/i.test(fret) ? 'x' : Number(fret), paren: Boolean(open && close) };
  }).filter(n => n.string > 0 && n.cx > x0 && n.cx < x1);
  return cluster(notes, n => n.cx, sys.sp * 0.5).map(g => ({ x: avg(g.map(n => n.cx)), notes: g.sort((a, b) => a.string - b.string) }));
}

// The glyphs of one system's staff that carry rhythm.
function staffGlyphs(pg, sys) {
  const { staff, tab, sp } = sys;
  const top = staff.top - sp * 7, bottom = Math.min(staff.bottom + sp * 7, tab.top - sp * 0.5);
  const inY = p => p.y0 >= top && p.y1 <= bottom;
  const heads = pg.paths.filter(p => inY(p) && p.paint === 'fill' && /^(mc+h)+$/.test(p.segs) &&
    Math.abs(p.y1 - p.y0 - sp) < sp * 0.25 && p.x1 - p.x0 > sp * 1.05 && p.x1 - p.x0 < sp * 2)
    .map(p => ({ ...p, cx: (p.x0 + p.x1) / 2, cy: (p.y0 + p.y1) / 2, hollow: p.segs.split('h').length > 2 }));
  const stems = pg.paths.filter(p => inY(p) && p.paint === 'stroke' && p.segs === 'ml' && p.x1 - p.x0 < 0.2 &&
    p.y1 - p.y0 > sp * 1.5 && p.lw > 0.4 && p.lw < 1.5);
  const beams = pg.paths.filter(p => inY(p) && p.paint === 'fill' && /^ml{3}h?$/.test(p.segs) && p.x1 - p.x0 > sp * 0.8)
    .map(p => {
      const byX = [...p.pts].sort((a, b) => a[0] - b[0]);
      const yl = (byX[0][1] + byX[1][1]) / 2, yr = (byX[2][1] + byX[3][1]) / 2;
      return { ...p, yAt: x => yl + ((yr - yl) * (x - p.x0)) / (p.x1 - p.x0 || 1) };
    });
  const flags = pg.paths.filter(p => inY(p) && p.paint === 'fill' && p.segs.includes('c') && !heads.includes(p) &&
    p.x1 - p.x0 > sp * 0.5 && p.x1 - p.x0 < sp * 1.8 && p.y1 - p.y0 > sp * 1.2 && p.y1 - p.y0 < sp * 4);
  const dots = pg.paths.filter(p => inY(p) && isCircle(p) && p.x1 - p.x0 < sp * 0.6 && p.x1 - p.x0 > sp * 0.25);
  return { heads, stems, beams, flags, dots };
}

// Duration of the beat at tab position x, read from the standard notation above it.
function rhythmAt(g, sp, x) {
  const heads = g.heads.filter(h => Math.abs(h.cx - x) < (h.x1 - h.x0) * 1.1);
  if (!heads.length) return null;
  const near = heads.filter(h => Math.abs(h.cx - x) < (h.x1 - h.x0) * 0.5);
  const hw = avg((near.length ? near : heads).map(h => h.x1 - h.x0));
  const stem = g.stems
    .filter(s => Math.abs(s.x0 - x) < hw * 0.75 && heads.some(h => h.cy > s.y0 - sp * 0.6 && h.cy < s.y1 + sp * 0.6))
    .sort((a, b) => Math.abs(Math.abs(a.x0 - x) - hw / 2) - Math.abs(Math.abs(b.x0 - x) - hw / 2))[0];
  let duration;
  if (!stem) duration = 1;
  else if (heads.some(h => h.hollow)) duration = 2;
  else {
    const sx = stem.x0;
    const beams = g.beams.filter(b => sx >= b.x0 - 0.6 && sx <= b.x1 + 0.6 && b.yAt(sx) > stem.y0 - sp * 0.6 && b.yAt(sx) < stem.y1 + sp * 0.6).length;
    // flags hang off the stem end that has no notehead
    const up = avg(heads.map(h => h.cy)) > (stem.y0 + stem.y1) / 2;
    const tipY = up ? stem.y0 : stem.y1;
    const flags = beams ? 0 : g.flags.filter(f => Math.abs(f.x0 - sx) < sp * 0.3 && f.y0 < tipY + sp * 1.5 && f.y1 > tipY - sp * 1.5).length;
    duration = 4 * 2 ** (beams + flags);
  }
  const right = Math.max(...heads.map(h => h.x1));
  const dotted = g.dots.some(d => d.x0 > right && d.x0 - right < sp * 1.2 && heads.some(h => Math.abs(h.cy - (d.y0 + d.y1) / 2) < sp));
  return { duration, dotted };
}

// Tuplet numbers ("3" over a bracket or a beam) and the x range they cover.
function tuplets(pg, sys, g) {
  const { staff, sp } = sys;
  // bracket halves: a horizontal line with a short hook at its outer end
  const brackets = pg.paths.filter(p => p.paint === 'stroke' && /^mll?$/.test(p.segs) && p.lw > 0.5 &&
    p.x1 - p.x0 > sp * 1.5 && p.y1 - p.y0 < sp);
  // Guitar Pro sets tuplet numbers in italics, which keeps bar numbers out
  return pg.texts.filter(t => /^[2-9]$/.test(t.str) && !t.rotated && (!t.font || /italic|oblique/i.test(t.font)) &&
    t.y > staff.top - sp * 9 && t.y < sys.tab.top - sp * 0.5)
    .map(t => {
      const cy = t.y - t.size * 0.35, tx0 = t.x, tx1 = t.x + t.w;
      const near = brackets.filter(b => Math.abs((b.y0 + b.y1) / 2 - cy) < sp * 0.8);
      const left = near.find(b => b.x1 <= tx0 + 0.5 && tx0 - b.x1 < sp * 1.5);
      const right = near.find(b => b.x0 >= tx1 - 0.5 && b.x0 - tx1 < sp * 1.5);
      if (left && right) return { n: Number(t.str), x0: left.x0, x1: right.x1 };
      const beam = g.beams.find(b => b.x0 < tx0 && b.x1 > tx1 && Math.abs(b.yAt(t.x) - cy) < sp * 2.5);
      return beam && { n: Number(t.str), x0: beam.x0 - sp, x1: beam.x1 + sp };
    }).filter(Boolean);
}

// ---------- header text: title, tuning, tempo ----------

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const STANDARD = { 4: [43, 38, 33, 28], 5: [43, 38, 33, 28, 23], 6: [64, 59, 55, 50, 45, 40], 7: [64, 59, 55, 50, 45, 40, 35],
  8: [64, 59, 55, 50, 45, 40, 35, 30] };
const pc = name => (NOTE[name[0].toUpperCase()] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0) + 12) % 12;
const midiName = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);

// Guitar Pro prints the tuning above the first system: "Standard tuning", "Drop D tuning",
// or one string per entry ("⑥ = D  ③ = G" / "1=E 2=B …").
function readTuning(lines, strings) {
  const std = STANDARD[strings] ?? STANDARD[6].slice(0, strings);
  const text = lines.join(' ');
  const semis = (name, from) => (pc(name) - (from % 12) + 18) % 12 - 6; // shortest move from a pitch to that note name
  const whole = text.match(/\b([A-G][b#]?)\s+[Ss]tandard/);
  if (whole) return { tuning: std.map(m => m + semis(whole[1], std.at(-1))) };
  if (/standard tuning/i.test(text)) return { tuning: std };
  const perString = [...text.matchAll(/(?:([1-8])|([\u2460-\u2467]))\s*=\s*([A-G][b#]?)/g)];
  if (perString.length) {
    const t = [...std];
    for (const [, digit, circled, name] of perString) {
      const i = (digit ? Number(digit) : circled.charCodeAt(0) - 0x2460 + 1) - 1;
      if (i < strings) t[i] += semis(name, std[i]);
    }
    return { tuning: t };
  }
  // Drop D keeps the other strings; Drop C (C G C F A D) also lowers them a tone
  const drop = text.match(/drop\s+([A-G][b#]?)/i);
  if (drop) {
    const d = semis(drop[1], std.at(-1) - 2);
    return { tuning: std.map((m, i) => m + d - (i === std.length - 1 ? 2 : 0)) };
  }
  const names = text.match(/\b[A-G][b#]?(?=\s|$)/g);
  if (names?.length === strings) return { tuning: names.reverse().map((n, i) => std[i] + semis(n, std[i])) };
  return { tuning: std, unknown: true };
}

// ---------- whole document ----------

const dur = b => (TICKS / b.duration) * (b.dotted ? 1.5 : 1) * (b.tuplet ? 2 ** Math.floor(Math.log2(b.tuplet)) / b.tuplet : 1);
const timeSig = ticks => [4, 8, 16, 32].map(d => [ticks / (TICKS / d), d]).find(([n]) => Number.isInteger(n) && n > 0) ?? [4, 4];

export async function pdfToTex(pdfjs, data, { name = '' } = {}) {
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, fontExtraProperties: true, verbosity: 0 }).promise;
  const bars = [];
  const header = [];
  const warnings = [];
  let strings = 0;

  for (let p = 1; p <= doc.numPages; p++) {
    const pg = await extractPage(pdfjs, await doc.getPage(p));
    const syss = systems(pg);
    if (p === 1 && syss.length) {
      const top = syss[0].staff.top - syss[0].sp * 2;
      header.push(...pg.texts.filter(t => t.y < top && !t.rotated));
    }
    for (const sys of syss) {
      const { sp, staff, tab } = sys;
      strings ||= tab.ys.length;
      if (tab.ys.length !== strings) {
        warnings.push(`page ${p}: skipped a ${tab.ys.length}-string tab (only the first track is read)`);
        continue;
      }
      const g = staffGlyphs(pg, sys);
      const tups = tuplets(pg, sys, g);
      const lines = barLines(pg, sys);
      // text above the staff: "3x" repeat counts and "= 120" tempo marks
      const above = pg.texts.filter(t => t.y < staff.top && t.y > staff.top - sp * 9);
      let start = tab.x0, opens = false;
      for (const line of lines) {
        const beats = tabBeats(pg, sys, start, line.x0);
        if (!beats.length && line.x0 - start < sp * 6) { opens ||= line.opens; start = line.x1; continue; } // clef area or double line
        const bar = { number: bars.length + 1, page: p, beats: [], opens, closes: line.closes ? 2 : 0, tempo: null };
        if (line.closes) {
          const count = above.find(t => /^\d+x$/i.test(t.str) && Math.abs(t.x + t.w / 2 - line.x) < sp * 4);
          bar.closes = count ? parseInt(count.str, 10) : 2;
        }
        const mark = above.find(t => /^=\s*\d+$/.test(t.str) && t.x > start - sp * 2 && t.x < line.x0);
        if (mark) bar.tempo = Number(mark.str.replace(/\D/g, ''));
        let unknown = 0;
        for (const b of beats) {
          const r = rhythmAt(g, sp, b.x);
          if (!r) unknown++;
          const tup = tups.find(t => b.x >= t.x0 - sp * 0.5 && b.x <= t.x1 + sp * 0.5);
          bar.beats.push({ notes: b.notes, duration: r?.duration ?? 4, dotted: r?.dotted ?? false, tuplet: tup?.n ?? 0 });
        }
        if (unknown) warnings.push(`bar ${bar.number}: rhythm of ${unknown} beat${unknown > 1 ? 's' : ''} not found, guessed quarter notes`);
        bars.push(bar);
        start = line.x1;
        opens = line.opens;
      }
    }
  }
  if (!bars.length) throw new Error('no tab found. Only PDFs exported from Guitar Pro with standard notation + tab can be read, not scans or screenshots.');

  // first page header: tempo, tuning, title/artist
  const headerText = header.map(t => t.str);
  const tempoText = headerText.find(s => /^=\s*\d+$/.test(s));
  let tempo = bars[0].tempo ?? (tempoText ? Number(tempoText.replace(/\D/g, '')) : null);
  if (!tempo) { tempo = 120; warnings.push('no tempo shown, using 120 bpm'); }
  const tuningLines = headerText.filter(s => /tuning/i.test(s) || /^([1-8\u2460-\u2467]\s*=\s*[A-G][b#]?[\s,]*)+$/.test(s) ||
    /^([A-G][b#]?\s+){3,}[A-G][b#]?$/.test(s));
  const { tuning, unknown } = readTuning(tuningLines, strings);
  if (unknown) warnings.push(tuningLines.length ? `tuning "${tuningLines.join(' ')}" not recognised, assuming standard tuning` : 'no tuning shown, assuming standard tuning');
  // title and artist: the two biggest lines of text (chord diagrams and bar numbers are small)
  const titled = header.filter(t => !tuningLines.includes(t.str) && !/^[=\d\s/]+$/.test(t.str) && t.size >= 14)
    .sort((a, b) => b.size - a.size);
  const title = titled[0]?.str || name.replace(/\.pdf$/i, '');
  const artist = titled[1] && titled[1].size < titled[0].size ? titled[1].str : '';

  // bar lengths give the time signature (Guitar Pro only prints it when it changes, as glyphs)
  const lengths = bars.map(b => b.beats.reduce((s, x) => s + dur(x), 0));
  const counts = {};
  for (const l of lengths) counts[l] = (counts[l] ?? 0) + 1;
  const common = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
  bars.forEach((b, i) => {
    if (lengths[i] && lengths[i] !== common) warnings.push(`bar ${b.number}: ${+(lengths[i] / 960).toFixed(2)} beats long while most bars have ${+(common / 960).toFixed(2)}, check the rhythm`);
    if (!b.beats.length) warnings.push(`bar ${b.number}: no notes found, filled with a rest`);
  });

  // ---------- alphaTex ----------
  const q = s => `"${s.replace(/["\\]/g, '')}"`;
  let prevTs = '';
  const lastFret = {};
  const barTex = bars.map((b, i) => {
    const out = [];
    const ts = timeSig(lengths[i] || common).join(' ');
    if (ts !== prevTs) out.push(`\\ts ${ts}`);
    prevTs = ts;
    if (b.opens) out.push('\\ro');
    if (b.closes) out.push(`\\rc ${b.closes}`);
    if (b.tempo && i > 0) out.push(`\\tempo ${b.tempo}`);
    if (!b.beats.length) { const [n, d] = timeSig(common); out.push(Array(n).fill(`r.${d}`).join(' ')); }
    for (const beat of b.beats) {
      const notes = beat.notes.map(n => {
        const tie = n.paren && lastFret[n.string] === n.fret;
        lastFret[n.string] = n.fret;
        return tie ? `-.${n.string}` : `${n.fret}.${n.string}${n.paren ? '{g}' : ''}`;
      });
      const fx = [beat.dotted && 'd', beat.tuplet && `tu ${beat.tuplet}`].filter(Boolean).join(' ');
      out.push(`${notes.length > 1 ? `(${notes.join(' ')})` : notes[0]}.${beat.duration}${fx ? `{${fx}}` : ''}`);
    }
    return out.join(' ');
  });
  const tex = `\\title ${q(title)}\n${artist ? `\\artist ${q(artist)}\n` : ''}\\tempo ${tempo}\n` +
    `\\tuning (${tuning.map(midiName).join(' ')})\n.\n${barTex.join(' |\n')}`;
  return { tex, title, artist, tempo, tuning, bars: bars.length, warnings };
}
