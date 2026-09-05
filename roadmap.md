# IALE roadmap

Approved feature menu lives in `.lovable/plan.md`. Shipping phase by phase.

## Phase A (done) — Features 20 + 24
- [x] Feature 20 — Proof Assistant ("Prove it's not regular"): tile-based proof builder,
      engine-validated moves, AI adversary via `IALE_PROOF_MOVE`.
- [x] Feature 24 — Stump the machine: student builds a DFA, AI/engine attacks it with
      verified counterexample strings, survival streak scoring.

## Phase B (done) — Feature 23 (AI Lesson Mode)
- [x] `<IALE_LESSON>` JSON script tag parsed/validated in `src/lib/tutor/lesson.ts`
      (closed beat vocabulary: say / do / ask / choice; `do` tags must pass the action registry).
- [x] `src/components/LessonPlayer.tsx` plays beats back, blocks on checkpoints and
      grades answers engine-side (`gradeAnswer`) — the model never adjudicates.

## Phase C (done) — Feature 21
- [x] `src/lib/engine/pda.ts` — BFS stack simulator, step cap, presets (balanced, aⁿbⁿ, wcwᴿ, equal, palindrome).
- [x] `src/lib/engine/tm.ts` — sparse-tape TM, 10k step cap, presets (aⁿbⁿcⁿ, palindrome, increment, runaway).
- [x] `PDALab.tsx` / `TMLab.tsx` modules + tabs; tutor tags `IALE_PDA_CHALLENGE`, `IALE_STACK_STEP`,
      `IALE_TM_CHALLENGE`, `IALE_TAPE_WRITE` / `IALE_TM_TRACE`.
## Phase D — Features 25, 26, 27 (curriculum path, duel links, PWA + worksheets)

Constraint for every phase: static-only, deployable to Netlify (`dist/client` + SPA fallback).
