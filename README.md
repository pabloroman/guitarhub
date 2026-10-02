# GuitarHub

A small web app for practicing guitar from Guitar Pro tabs:

- **Library**: upload `.gp3` / `.gp4` / `.gp5` / `.gpx` / `.gp` files, then tag and search them.
- **PDF import**: upload a PDF exported from Guitar Pro (standard notation + tab) and it's converted into a playable tab. You check the result before it's added. Scanned pages and screenshots can't be read.
- **Player**: renders the tab and plays it back. You can set the speed in bpm, drag across bars to loop them, and turn on a metronome and count-in. The **Print** button opens a page-sized version of the current track to print or save as a PDF.
- **Speed trainer**: loops the selected bars and raises the tempo every few loops, e.g. from 70% to 100% in 5% steps every 3 loops. A **Too fast** button drops back one step.
- **Fingering optimizer**: suggests easier fingerings, for example keeping a phrase in one hand position instead of jumping around the neck. You review the suggestions bar by bar and accept the ones you like. Accepted changes are stored separately, so your original file is never modified.
- **Practice**: built-in technique drills, each with a tempo ladder: mark a run "clean" and the tempo goes up 5 bpm, reach the target and the next level unlocks. A calendar shows the days you practiced and your streak.
- **Practice log**: on any tab, log what you practiced (bars, clean tempo, what felt hard).
- **Resources**: pick a root and a scale (major, minor, pentatonics, blues, harmonic minor or a mode), from the dropdowns or on a circle of fifths, to see the scale across the fretboard, as note names or degrees, and the key's chords as chord boxes with their Roman numerals. Step through the scale's hand positions one at a time (the five CAGED positions, each named after the chord shape it sits around, or three notes per string) and play each as tab, pick a chord to hear it and see where its notes sit on the neck, or loop a common progression in the key to play along with. Any of these can be added to your Practice drills, with the same tempo ladder as the built-in ones. A **chord finder** shows up to six ways to play any chord (triads, sus, 6ths, 7ths, 9ths) from the nut up the neck. Everything can be shown in other tunings (Drop D, DADGAD, open tunings…), and each tab's page guesses the key it's in and links to that scale in the tab's own tuning. A **note trainer** has two 60-second games for learning the neck, find every place a note sits or name the note shown, and logs each round to the Practice calendar.

Sign in with Google and you get your own private library. Tabs, fingering edits and the practice log are stored in [Supabase](https://supabase.com), so they follow you to any browser.

## Running your own copy

You need [Node.js](https://nodejs.org) 20 or newer and a free Supabase project.

1. In Supabase, create a project and run `supabase/schema.sql` in the SQL editor. It creates the tables, the file bucket and the access rules that keep each user's data private. A project set up before the note trainer existed needs one more line, or its rounds aren't logged: `alter table sessions add column activity text;`
2. Under Authentication → Providers, turn **Email** off and turn **Google** on, using an OAuth client from Google Cloud whose redirect URI is `https://<project ref>.supabase.co/auth/v1/callback`.
3. Under Authentication → URL Configuration, add `http://localhost:3000/` and your site's URL to the redirect URLs.
4. Put the project URL and publishable key in `public/db.js`. Both are meant to be public; the access rules in `schema.sql` are what protect the data.

```sh
git clone https://github.com/pabloroman/guitarhub.git
cd guitarhub
npm install
npm start
```

Then open http://localhost:3000. Use `localhost`, not `127.0.0.1`, or the Google sign-in can't redirect back. The dev server only serves files; it uses the same Supabase project as the hosted site.

## Deploying

The site is static. `npm run build` assembles it in `dist/`, and `vercel.json` tells [Vercel](https://vercel.com) to run that on every push to `main`.

Supabase's free tier may pause a project after about a week with little activity. Nothing is lost and it can be resumed from the dashboard, but the site is down until then. The free tier also has no backups.

## Tests

```sh
npm test
```

The tests cover the fingering optimizer, the PDF import, the drills and the music theory behind the Resources page: note spelling, chord shapes and voicings, scale positions and the tab generated from them. The optimizer tests include a few real passages where a player's preferred fingering is used as the expected answer. The PDF tests convert the Guitar Pro exports in `test/fixtures/`.

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

- Plain HTML and JavaScript, with no framework and no bundler: the build only copies files.
- [Supabase](https://supabase.com) for the database, tab files and sign-in. The browser talks to it directly, and row-level security keeps each user's data private.
- [alphaTab](https://alphatab.net) for parsing, rendering and playing the tabs.

## How the PDF import works

`public/pdftab.js` doesn't look at the page as an image. A Guitar Pro PDF is made of drawing commands, and it reads those back:

- **Fret numbers** are text; the tab line each one sits on gives the string, and numbers at the same x form a chord.
- **Rhythm** comes from the standard notation above the tab: hollow or filled noteheads, stems, the number of beams or flags, dots, and italic tuplet numbers with their brackets.
- **Bar lines and repeat dots** mark bars and repeats; the "3x" above a closing repeat is the repeat count.
- **Tempo** ("= 120"), **tuning** ("Standard tuning", "Drop D tuning", …), **title** and **artist** come from the text at the top of the first page.
- The time signature is worked out from the bar lengths. Bars that are a different length from most others are listed as warnings.

The result is written as alphaTex, loaded by alphaTab and saved as a `.gp` file, so everything else in the app works on it the same way as on an uploaded Guitar Pro file.

Guitar Pro writes PDFs in two ways and both are read: as shapes (macOS "Save as PDF"), or with noteheads, dots, flags and rests as characters of a music font (the Windows/Qt export). Rests are only read in the second kind so far.

Not read yet: ties, techniques (bends, slides, hammer-ons, palm mutes…), and PDFs with more than one track.
