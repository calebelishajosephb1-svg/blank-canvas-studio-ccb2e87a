/**
 * Feature 20 — Proof Assistant: "prove L is not regular".
 *
 * The pumping game (engine/pumping.ts) plays ONE adversary decomposition. A real
 * proof has to survive *every* legal decomposition, and that universal quantifier
 * is exactly what students get wrong. This module models the proof as an ordered
 * sequence of steps, and validates each move against the language predicate — so
 * the adversary (app or AI) can bluff and the engine still adjudicates.
 *
 * Nothing here trusts the tutor: an AI-supplied p or decomposition is checked
 * against the same rules a student's move is.
 */

import {
  checkCandidate,
  legalSplits,
  pump,
  splitLabel,
  type PumpingLanguage,
  type Split,
} from "./pumping";

export const PROOF_STEPS = [
  "assume",
  "obtain-p",
  "choose-s",
  "quantify",
  "pump",
  "conclude",
] as const;
export type ProofStepId = (typeof PROOF_STEPS)[number];

export interface StepMeta {
  id: ProofStepId;
  title: string;
  /** What the student is committing to at this step. */
  claim: (ctx: ProofContext) => string;
  /** Socratic nudge shown next to the step — never the answer. */
  nudge: string;
}

export interface ProofContext {
  lang: PumpingLanguage;
  p: number | null;
  s: string;
  i: number | null;
}

export const PROOF_SCRIPT: StepMeta[] = [
  {
    id: "assume",
    title: "Assume, for contradiction",
    claim: (c) => `Suppose ${c.lang.formal.replace(/^L = /, "L = ")} is regular.`,
    nudge: "Every pumping-lemma proof is a proof by contradiction. State the assumption first.",
  },
  {
    id: "obtain-p",
    title: "Obtain the pumping length",
    claim: (c) =>
      `Then the pumping lemma gives a pumping length p${c.p ? ` (the adversary commits to p = ${c.p})` : ""}. p is not ours to pick.`,
    nudge: "p comes from the lemma, not from you. Your argument has to work for whatever p is.",
  },
  {
    id: "choose-s",
    title: "Choose s ∈ L with |s| ≥ p",
    claim: (c) => `Choose s = "${c.s || "…"}" ∈ L, with |s| = ${c.s.length} ≥ p.`,
    nudge:
      "This is the one thing you control. Pick s so that the constraint |xy| ≤ p pins y down to a single kind of symbol.",
  },
  {
    id: "quantify",
    title: "Quantify over every decomposition",
    claim: () =>
      "Let s = xyz be ANY decomposition with |xy| ≤ p and |y| > 0. (Not one decomposition — all of them.)",
    nudge:
      "The lemma lets the adversary choose xyz. If your argument only kills one split, it proves nothing.",
  },
  {
    id: "pump",
    title: "Pump and leave the language",
    claim: (c) =>
      `Take i = ${c.i ?? "…"}. Then xy${c.i ?? "i"}z ∉ L for every such decomposition.`,
    nudge:
      "One exponent has to work uniformly. Ask what y must consist of, and what repeating it does to the quantity L counts.",
  },
  {
    id: "conclude",
    title: "Conclude the contradiction",
    claim: (c) =>
      `This contradicts the pumping lemma, so ${c.lang.name} is not regular. ∎`,
    nudge: "Name the contradiction explicitly — that is the part graders look for.",
  },
];

/* ───────────────── move validation ───────────────── */

export interface MoveResult {
  ok: boolean;
  message: string;
}

/** p must be a usable pumping length; the adversary may not pick something absurd. */
export function validateP(value: unknown): MoveResult & { p: number } {
  const p = Math.floor(Number(value));
  if (!Number.isFinite(p) || p < 1)
    return { ok: false, p: 0, message: "A pumping length must be a positive integer." };
  if (p > 12)
    return {
      ok: false,
      p: 0,
      message: `p = ${p} is legal in theory but unworkable on screen — keep it at 12 or below.`,
    };
  return { ok: true, p, message: `Adversary commits to p = ${p}.` };
}

export function validateS(lang: PumpingLanguage, s: string, p: number): MoveResult {
  return checkCandidate(lang, s, p);
}

/** A decomposition the adversary offers must actually be legal for (s, p). */
export function validateSplit(split: Split, s: string, p: number): MoveResult {
  if (split.x + split.y + split.z !== s)
    return { ok: false, message: `That decomposition doesn't reassemble to "${s}".` };
  if (split.y.length === 0) return { ok: false, message: "|y| > 0 is required." };
  if ((split.x + split.y).length > p)
    return {
      ok: false,
      message: `|xy| = ${(split.x + split.y).length} exceeds p = ${p}. Illegal decomposition — call it out.`,
    };
  return { ok: true, message: `${splitLabel(split)} is legal.` };
}

export interface UniversalCheck {
  ok: boolean;
  total: number;
  broken: number;
  /** Decompositions that survive this exponent — the holes in the proof. */
  survivors: Split[];
  message: string;
}

/**
 * The heart of the feature: does exponent i break EVERY legal decomposition?
 * A student who beat the single-adversary game usually discovers here that
 * their exponent only worked against the split they were handed.
 */
export function checkUniversalPump(
  lang: PumpingLanguage,
  s: string,
  p: number,
  i: number,
): UniversalCheck {
  const splits = legalSplits(s, p);
  if (!splits.length)
    return {
      ok: false,
      total: 0,
      broken: 0,
      survivors: [],
      message: "No legal decomposition exists for this s and p — choose a longer s.",
    };
  const survivors = splits.filter((sp) => lang.member(pump(sp, i)));
  const broken = splits.length - survivors.length;
  if (!survivors.length)
    return {
      ok: true,
      total: splits.length,
      broken,
      survivors: [],
      message: `i = ${i} kicks all ${splits.length} legal decomposition(s) out of L. The proof closes.`,
    };
  return {
    ok: false,
    total: splits.length,
    broken,
    survivors: survivors.slice(0, 4),
    message: `i = ${i} breaks ${broken}/${splits.length} decompositions — ${survivors.length} still land back in L. A proof has to cover every one.`,
  };
}

/** Smallest exponent (0..maxI) that works universally, or null. Used for scoring only. */
export function bestUniversalExponent(
  lang: PumpingLanguage,
  s: string,
  p: number,
  maxI = 5,
): number | null {
  for (let i = 0; i <= maxI; i++) if (checkUniversalPump(lang, s, p, i).ok) return i;
  return null;
}

/** Is this s salvageable at all? Lets the app warn before the student burns moves. */
export function sIsWinnable(lang: PumpingLanguage, s: string, p: number): boolean {
  return bestUniversalExponent(lang, s, p) !== null;
}

/* ───────────────── export ───────────────── */

export function renderProof(ctx: ProofContext, splitsCovered: number): string {
  const { lang, p, s, i } = ctx;
  return [
    `Claim: ${lang.formal} is not regular.`,
    "",
    "Proof (by contradiction).",
    `1. Suppose L were regular. Then the pumping lemma yields a pumping length p${p ? ` = ${p}` : ""}.`,
    `2. Choose s = "${s}" ∈ L. Note |s| = ${s.length} ≥ p.`,
    `3. Let s = xyz be any decomposition with |xy| ≤ p and |y| > 0 (${splitsCovered} such decompositions exist here).`,
    `4. Because |xy| ≤ p, y lies entirely inside the first p symbols of s.`,
    `5. Take i = ${i}. Then xy^${i}z ∉ L for every such decomposition.`,
    "6. This contradicts the pumping lemma. Therefore L is not regular. ∎",
    "",
    `Language intuition: ${lang.intuition}`,
  ].join("\n");
}
