# GuitarHub

A small local web app for practicing guitar from Guitar Pro tabs:

- **Library**: upload `.gp3` / `.gp4` / `.gp5` / `.gpx` / `.gp` files, then tag and search them.
- **Player**: renders the tab and plays it back. You can set the speed in bpm, drag across bars to loop them, and turn on a metronome and count-in.
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

The tests cover the fingering optimizer. They include a few real passages where a player's preferred fingering is used as the expected answer.

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
