# GuitarHub

A small local web app for practicing guitar from Guitar Pro tabs:

- **Library**: upload `.gp3` / `.gp4` / `.gp5` / `.gpx` / `.gp` files, then tag and search them.
- **PDF import**: upload a PDF exported from Guitar Pro (standard notation + tab) and it's converted into a playable tab. You check the result before it's added. Scanned pages and screenshots can't be read.
- **Player**: renders the tab and plays it back. You can set the speed in bpm, drag across bars to loop them, and turn on a metronome and count-in. The **Print** button opens a page-sized version of the current track to print or save as a PDF.
- **Speed trainer**: loops the selected bars and raises the tempo every few loops, e.g. from 70% to 100% in 5% steps every 3 loops. A **Too fast** button drops back one step.
- **Fingering optimizer**: suggests easier fingerings, for example keeping a phrase in one hand position instead of jumping around the neck. You review the suggestions bar by bar and accept the ones you like. Accepted changes are stored separately, so your original file is never modified.
- **Tutor**: log what you practiced (bars, clean tempo, what felt hard) and get exercises built from those passages. Each exercise has a tempo ladder: mark a run "clean" and the tempo goes up 5 bpm.

It runs on your own machine only, for a single user with no login.

## Requirements

- [Node.js](https://nodejs.org) 22.13 or newer (it uses the built-in `node:sqlite`; developed on Node 24).
- For the tutor only: [Claude Code](https://claude.com/claude-code), installed and logged in. The tutor runs `claude -p` in the background, so its usage counts against your Claude Code plan. No API key is needed. Everything else works without it.

## Setup

```sh
git clone https://github.com/pabloroman/guitarhub.git
cd guitarhub
npm install
npm start
```

Then open http://localhost:3000.

The server listens on `127.0.0.1` only. Set `PORT` to use a different port (`PORT=4000 npm start`).

Your tabs, fingering edits and practice log are stored in `data/`, which is created on first run and excluded from git. Back up that folder to keep your library.

## Tests

```sh
npm test
```

The tests cover the fingering optimizer and the PDF import. The optimizer tests include a few real passages where a player's preferred fingering is used as the expected answer. The PDF tests convert the Guitar Pro exports in `test/fixtures/`.

## How the fingering optimizer works

`public/optimizer.js` finds the cheapest way to play each track using a Viterbi search: for each group of notes it considers every string/fret option and every hand position. Costs:

- **Hand shifts** cost the most. A shift is cheaper when there's time for it (during a long note or a rest), and free at a new section or tempo change.
- **String changes** cost a little. Skipping over strings costs more.
- **Chord shapes** stay on their strings. Sliding the same shape along the neck counts as a single movement.
- **Moving a note** away from the tab's fingering costs something, and a change is only suggested if it saves a meaningful amount.
- **Bends, slides, hammer-ons/pull-offs, ties and harmonics** are never moved.

There are two styles:

- **Stay in position** (default): changing strings is cheap, moving the hand is expensive. Best for picked melodies and riffs.
- **Stay on one string**: the opposite. Best for tremolo-picked lines.

The weights are at the top of `optimizer.js`. They're tuned against the test cases, so if a suggestion feels wrong to your hands, add that passage as a test and retune.

## Stack

- Node's built-in `http` and `sqlite` modules, with no framework.
- Plain HTML and JavaScript, with no build step.
- [alphaTab](https://alphatab.net) for parsing, rendering and playing the tabs.

## How the PDF import works

`public/pdftab.js` doesn't look at the page as an image. A Guitar Pro PDF is made of drawing commands, and it reads those back:

- **Fret numbers** are text; the tab line each one sits on gives the string, and numbers at the same x form a chord.
- **Rhythm** comes from the standard notation above the tab: hollow or filled noteheads, stems, the number of beams or flags, dots, and italic tuplet numbers with their brackets.
- **Bar lines and repeat dots** mark bars and repeats; the "3x" above a closing repeat is the repeat count.
- **Tempo** ("= 120"), **tuning** ("Standard tuning", "Drop D tuning", …), **title** and **artist** come from the text at the top of the first page.
- The time signature is worked out from the bar lengths. Bars that are a different length from most others are listed as warnings.

The result is written as alphaTex, loaded by alphaTab and saved as a `.gp` file, so everything else in the app works on it the same way as on an uploaded Guitar Pro file.

Not read yet: rests, ties, techniques (bends, slides, hammer-ons, palm mutes…), and PDFs with more than one track.
