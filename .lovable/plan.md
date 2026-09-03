# One-of-a-kind features for IALE (all static / Netlify-compatible)

Constraint honored throughout: **zero server code**. Everything runs in-browser (pure TS algorithms, localStorage/URL persistence, BYOK tutor calls directly from the browser). Netlify stays a static publish of `dist/client` + SPA fallback.

## Feature 20 — Proof Assistant: "Prove it's not regular" (flagship, deeper pedagogy)
A structured proof-builder for pumping-lemma arguments — the thing every automata student dreads and no existing tool teaches interactively.
- Student assembles a proof step-by-step from tiles: *assume L regular → adversary gives p → I choose w → adversary splits w=xyz with |xy|≤p, |y|>0 → I pump i → show w_i ∉ L → contradiction*.
- **The AI plays the adversary** via a new tag: it hands p, then reacts to the student's w with legal/illegal splits (validated by the engine, not the model's say-so). Student must beat the adversary, not just recite.
- Engine-side validation of every move (|xy|≤p etc. checked in `src/lib/engine/pumping.ts`), so the AI can bluff and the app can call the bluff — a genuinely Socratic game no textbook site has.
- Tutor tag: `IALE_PROOF_MOVE` constrained to a closed move vocabulary (same pattern as `PUMPING_KINDS`).

## Feature 21 — PDA & Turing Machine labs (new machine models)
Pure-TS simulators, same canvas grammar as the DFA lab.
- **PDA Lab**: states + stack tape visualization, step-through with visible push/pop, acceptance by final state or empty stack. Tutor tags: `IALE_STACK_STEP`, `IALE_PDA_CHALLENGE` (e.g. balanced parens, aⁿbⁿ, wcwᴿ).
- **TM Lab (mini)**: infinite tape strip, head position, transition table, step/run-to-halt with a step cap (say 10k) so infinite loops fail gracefully. Tutor tags: `IALE_TAPE_WRITE`, `IALE_TM_TRACE`.
- Both share the existing trace/animation infra and alphabet system (`parseAlphabet`, arbitrary Σ).

## Feature 22 — Mealy/Moore & transducer playground (new machine models, small)
Same DFA canvas with output labels on transitions/states; live "input → output stream" animation. Uniquely good for teaching sequential circuits vs. recognizers. Tutor can set transducer challenges and animate output traces.

## Feature 23 — AI Lesson Mode (AI as co-instructor, flagship)
The tutor stops being a Q&A box and becomes a director:
- `IALE_LESSON` tag: the model emits a **scripted multi-step lesson** — a JSON-ish sequence of {say, action, wait-for-student} beats. The app plays it back: highlight state → ask question → wait for the student to click the right state → celebrate or re-teach.
- Guarded: beats validated against a closed action vocabulary (the existing registry); student answers checked by the engine (click-target, string test), never by trusting the model.
- This makes even a weak model feel like a teacher, because the *app* enforces correctness and the model only choreographs.

## Feature 24 — Adversarial Tutor / "Stump the machine" (AI as co-instructor + deeper pedagogy)
Role reversal: the **student builds a machine, the AI attacks it** — generating candidate counterexample strings one at a time; each is actually verified by `findCounterexample` before being shown. Score = how many verified attacks the student's machine survives. Teaches specification clarity better than any exercise set.

## Feature 25 — Misconception-driven curriculum path (deeper pedagogy, small)
We already log mistakes per category and detect recurring habits. Add a generated **learning path**: a linear skill tree (alphabet → transitions → acceptance → sinks → NFA → ε-moves → regex → minimization → pumping) where each node unlocks from demonstrated mastery (solve + low hint usage), and the tutor's greeting references exactly where you are. `Storage`-backed, no server.

## Feature 26 — Shareable challenge arena (collaboration/sharing, URL-only)
Extend the existing `?pack=` / URL-encoded machine sharing:
- **Duel links**: encode {challenge, your score/time} in a URL; a friend opens it, plays the same challenge, and the page shows a side-by-side result card ("You: 3 hints, 4:12 — Caleb: 1 hint, 2:58"). No backend, no accounts — the link *is* the match.
- **Pack leaderboard-in-URL**: assignment pack links carry per-challenge best-of records appended by each solver (compressed JSON in hash), so a study group can pass one evolving link around.

## Feature 27 — Offline-first PWA + print worksheets (learning-environment polish)
- Service worker + manifest so the whole lab works offline on a plane/field trip (static hosting = trivial).
- **Worksheet generator**: print-friendly pages — a rendered machine with blanks for transitions, or a regex with "list 3 strings in / 3 not in L" — with an answer key on page 2. Teachers get exam paper from the same tool students practice in.

## Suggested sequencing
1. **20 + 24** first — they reuse pumping.ts, findCounterexample, and the action registry; biggest pedagogical payoff per line.
2. **23 (Lesson Mode)** next — the architectural leap that makes the tutor feel integrated everywhere.
3. **21 (PDA first, TM second)** — new models, highest implementation cost.
4. **25, 26, 27** — small, independent, shippable in any order.

## Technical notes
- All new simulators (PDA/TM/Mealy) are deterministic step-functions with step caps; no WASM needed.
- Every AI feature uses the existing pattern: closed action-tag vocabulary in `src/lib/tutor/actions.ts` + engine-side verification; the model choreographs, the app adjudicates. No new trust surface.
- Persistence stays in `localStorage` (`src/lib/storage.ts`); sharing stays URL-hash-encoded (`src/lib/share.ts`, `src/lib/packs.ts`).
- Netlify config unchanged; PWA adds only static assets + a tiny SW file in `public/`.
