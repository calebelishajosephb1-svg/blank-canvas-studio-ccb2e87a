/**
 * Feature 24 — "Stump the machine".
 *
 * Role reversal: the student builds a DFA for a target language and the tutor
 * (or the engine itself) attacks it with candidate strings. Every attack is
 * adjudicated here against the reference DFA — the model only *proposes*
 * strings, it never gets to say whether an attack landed. A model that
 * hallucinates a counterexample simply produces a bounced attack.
 */

import type { DFA } from "./dfa";
import { findCounterexample } from "./algorithms";

export interface AttackResult {
  string: string;
  /** What the target language says. */
  expected: "accept" | "reject";
  /** What the student's machine says. */
  got: "accept" | "reject";
  /** True when the string exposes a real disagreement. */
  landed: boolean;
  /** Rejected before adjudication (symbol outside Σ, duplicate, too long). */
  invalid: string | null;
}

const verdict = (b: boolean): "accept" | "reject" => (b ? "accept" : "reject");

export function judgeAttack(
  ref: DFA,
  student: DFA,
  raw: string,
  opts: { tried?: Set<string>; maxLen?: number } = {},
): AttackResult {
  const str = raw;
  const maxLen = opts.maxLen ?? 40;
  const base: Omit<AttackResult, "invalid"> = {
    string: str,
    expected: verdict(ref.run(str)),
    got: verdict(student.run(str)),
    landed: false,
  };
  const bad = [...str].find((c) => !ref.alphabet.includes(c));
  if (bad) return { ...base, landed: false, invalid: `"${bad}" is not in Σ — attack thrown out.` };
  if (str.length > maxLen)
    return { ...base, landed: false, invalid: `Longer than ${maxLen} symbols — attack thrown out.` };
  if (opts.tried?.has(str))
    return { ...base, landed: false, invalid: `"${str || "ε"}" was already tried.` };
  return { ...base, landed: base.expected !== base.got, invalid: null };
}

/**
 * The engine's own attack: the shortest string the two machines disagree on that
 * has not been tried yet. Returns null when the student's machine is correct
 * (or correct on everything not yet thrown at it).
 */
export function engineAttack(ref: DFA, student: DFA, tried: Set<string>): string | null {
  const ce = findCounterexample(ref, student);
  if (ce && !tried.has(ce.string)) return ce.string;
  // Fall back to a breadth-first sweep so repeated rounds don't stall on the
  // same shortest counterexample the student has already seen.
  const queue: string[] = [""];
  const seen = new Set<string>([""]);
  while (queue.length) {
    const s = queue.shift()!;
    if (!tried.has(s) && ref.run(s) !== student.run(s)) return s;
    if (s.length >= 12) continue;
    for (const sym of ref.alphabet) {
      const next = s + sym;
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return null;
}

/**
 * A plausible-but-harmless probe, used when the machine is already correct so
 * the arena still has something to show. Prefers strings near the language
 * boundary (accepted strings and their one-symbol perturbations).
 */
export function probeString(ref: DFA, tried: Set<string>): string | null {
  const samples = ref.sampleStrings({ maxLen: 8, count: 40 });
  const pool: string[] = [];
  for (const s of [...samples.accepted, ...samples.rejected]) {
    pool.push(s);
    for (const sym of ref.alphabet) pool.push(s + sym, sym + s);
  }
  return pool.find((s) => !tried.has(s) && s.length <= 12) ?? null;
}

export interface ArenaScore {
  survived: number;
  landed: number;
  streak: number;
  bestStreak: number;
}

export const emptyScore = (): ArenaScore => ({
  survived: 0,
  landed: 0,
  streak: 0,
  bestStreak: 0,
});

export function applyResult(score: ArenaScore, r: AttackResult): ArenaScore {
  if (r.invalid) return score;
  if (r.landed) return { ...score, landed: score.landed + 1, streak: 0 };
  const streak = score.streak + 1;
  return {
    ...score,
    survived: score.survived + 1,
    streak,
    bestStreak: Math.max(score.bestStreak, streak),
  };
}

/** Which misconception a landed attack points at — feeds the existing mistake log. */
export function attackCategory(ref: DFA, student: DFA, r: AttackResult): string {
  const trace = student.runWithTrace(r.string);
  if (trace.crashed) return "crash";
  if (!student.isComplete()) return "transition";
  if (r.expected === "reject" && r.got === "accept") return "accept";
  const reachesSink = [...student.reachableStates()].length < ref.reachableStates().size;
  return reachesSink ? "sink" : "accept";
}
