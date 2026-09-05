/**
 * Single-tape Turing machine — pure, capped, never throws.
 *
 * The tape is a sparse map from integer cell index to symbol, so it is
 * conceptually infinite in both directions without allocating anything.
 * Every run has a hard step cap: an infinite loop reports "step cap reached"
 * instead of freezing the browser.
 */

export const BLANK = "_";
export const TM_STEP_CAP = 10000;

export interface TMRule {
  from: string;
  read: string;
  write: string;
  move: "L" | "R" | "S";
  to: string;
}

export interface TMJSON {
  states: string[];
  inputAlphabet: string[];
  tapeAlphabet: string[];
  startState: string;
  acceptState: string;
  rejectState: string;
  rules: TMRule[];
}

export interface TMStep {
  state: string;
  head: number;
  /** Tape contents rendered over the visited window. */
  cells: { index: number; symbol: string }[];
  /** Rule applied to REACH this step (null for the initial configuration). */
  via: TMRule | null;
}

export type TMHalt = "accept" | "reject" | "stuck" | "cap";

export interface TMRun {
  halt: TMHalt;
  steps: TMStep[];
  totalSteps: number;
  /** Final tape as a trimmed string, useful for transducer-style machines. */
  output: string;
}

type Tape = Map<number, string>;

function read(tape: Tape, i: number): string {
  return tape.get(i) ?? BLANK;
}

function window(tape: Tape, head: number, pad = 6): { index: number; symbol: string }[] {
  const keys = [...tape.keys()];
  const lo = Math.min(head - pad, ...(keys.length ? keys : [head]));
  const hi = Math.max(head + pad, ...(keys.length ? keys : [head]));
  const cells: { index: number; symbol: string }[] = [];
  for (let i = lo; i <= hi; i++) cells.push({ index: i, symbol: read(tape, i) });
  return cells;
}

function trim(tape: Tape): string {
  const keys = [...tape.keys()].sort((a, b) => a - b);
  if (!keys.length) return "";
  let out = "";
  for (const k of keys) out += read(tape, k);
  return out.replace(/^_+|_+$/g, "");
}

export function runTM(tm: TMJSON, input: string, cap = TM_STEP_CAP): TMRun {
  const tape: Tape = new Map();
  [...input].forEach((sym, i) => tape.set(i, sym));
  let head = 0;
  let state = tm.startState;
  const steps: TMStep[] = [{ state, head, cells: window(tape, head), via: null }];
  const KEEP = 400; // only the first KEEP configurations are stored for display
  let total = 0;

  for (let n = 0; n < cap; n++) {
    if (state === tm.acceptState)
      return { halt: "accept", steps, totalSteps: total, output: trim(tape) };
    if (state === tm.rejectState)
      return { halt: "reject", steps, totalSteps: total, output: trim(tape) };
    const sym = read(tape, head);
    const rule = tm.rules.find((r) => r.from === state && r.read === sym);
    if (!rule) return { halt: "stuck", steps, totalSteps: total, output: trim(tape) };
    tape.set(head, rule.write);
    head += rule.move === "L" ? -1 : rule.move === "R" ? 1 : 0;
    state = rule.to;
    total++;
    if (steps.length < KEEP) steps.push({ state, head, cells: window(tape, head), via: rule });
  }
  return { halt: "cap", steps, totalSteps: total, output: trim(tape) };
}

export function tmAccepts(tm: TMJSON, input: string, cap = TM_STEP_CAP): boolean {
  return runTM(tm, input, cap).halt === "accept";
}

export function tmRuleLabel(r: TMRule): string {
  return `${r.read} → ${r.write}, ${r.move}`;
}

export function validateTM(tm: TMJSON): string[] {
  const problems: string[] = [];
  if (!tm.states.includes(tm.startState)) problems.push("Start state is not in the state set.");
  if (!tm.states.includes(tm.acceptState)) problems.push("Accept state is not in the state set.");
  for (const r of tm.rules) {
    if (!tm.states.includes(r.from) || !tm.states.includes(r.to))
      problems.push(`Rule ${r.from}→${r.to} mentions an unknown state.`);
    if (!tm.tapeAlphabet.includes(r.read)) problems.push(`Rule reads "${r.read}", outside Γ.`);
    if (!tm.tapeAlphabet.includes(r.write)) problems.push(`Rule writes "${r.write}", outside Γ.`);
  }
  return problems;
}

export interface TMPreset {
  id: string;
  name: string;
  formal: string;
  intuition: string;
  tm: TMJSON;
  samples: { str: string; inLanguage: boolean }[];
}

/** aⁿbⁿcⁿ — the classic not-even-context-free language, crossed off one triple at a time. */
const anbncn: TMJSON = {
  states: ["q0", "q1", "q2", "q3", "q4", "qa", "qr"],
  inputAlphabet: ["a", "b", "c"],
  tapeAlphabet: ["a", "b", "c", "X", "Y", "Z", BLANK],
  startState: "q0",
  acceptState: "qa",
  rejectState: "qr",
  rules: [
    { from: "q0", read: "a", write: "X", move: "R", to: "q1" },
    { from: "q0", read: "Y", write: "Y", move: "R", to: "q4" },
    { from: "q0", read: BLANK, write: BLANK, move: "S", to: "qa" },
    { from: "q0", read: "b", write: "b", move: "S", to: "qr" },
    { from: "q0", read: "c", write: "c", move: "S", to: "qr" },

    { from: "q1", read: "a", write: "a", move: "R", to: "q1" },
    { from: "q1", read: "Y", write: "Y", move: "R", to: "q1" },
    { from: "q1", read: "b", write: "Y", move: "R", to: "q2" },
    { from: "q1", read: BLANK, write: BLANK, move: "S", to: "qr" },
    { from: "q1", read: "c", write: "c", move: "S", to: "qr" },

    { from: "q2", read: "b", write: "b", move: "R", to: "q2" },
    { from: "q2", read: "Z", write: "Z", move: "R", to: "q2" },
    { from: "q2", read: "c", write: "Z", move: "L", to: "q3" },
    { from: "q2", read: BLANK, write: BLANK, move: "S", to: "qr" },
    { from: "q2", read: "a", write: "a", move: "S", to: "qr" },

    { from: "q3", read: "a", write: "a", move: "L", to: "q3" },
    { from: "q3", read: "b", write: "b", move: "L", to: "q3" },
    { from: "q3", read: "Y", write: "Y", move: "L", to: "q3" },
    { from: "q3", read: "Z", write: "Z", move: "L", to: "q3" },
    { from: "q3", read: "X", write: "X", move: "R", to: "q0" },

    { from: "q4", read: "Y", write: "Y", move: "R", to: "q4" },
    { from: "q4", read: "Z", write: "Z", move: "R", to: "q4" },
    { from: "q4", read: BLANK, write: BLANK, move: "S", to: "qa" },
    { from: "q4", read: "a", write: "a", move: "S", to: "qr" },
    { from: "q4", read: "b", write: "b", move: "S", to: "qr" },
    { from: "q4", read: "c", write: "c", move: "S", to: "qr" },
  ],
};

/** Binary increment — a transducer: the tape output is the answer. */
const increment: TMJSON = {
  states: ["r", "add", "done"],
  inputAlphabet: ["0", "1"],
  tapeAlphabet: ["0", "1", BLANK],
  startState: "r",
  acceptState: "done",
  rejectState: "qr",
  rules: [
    { from: "r", read: "0", write: "0", move: "R", to: "r" },
    { from: "r", read: "1", write: "1", move: "R", to: "r" },
    { from: "r", read: BLANK, write: BLANK, move: "L", to: "add" },
    { from: "add", read: "1", write: "0", move: "L", to: "add" },
    { from: "add", read: "0", write: "1", move: "S", to: "done" },
    { from: "add", read: BLANK, write: "1", move: "S", to: "done" },
  ],
};

/** Even-length palindromes over {a,b} — match the ends, erase, repeat. */
const palindrome: TMJSON = {
  states: ["s", "ra", "rb", "backA", "backB", "home", "qa", "qr"],
  inputAlphabet: ["a", "b"],
  tapeAlphabet: ["a", "b", BLANK],
  startState: "s",
  acceptState: "qa",
  rejectState: "qr",
  rules: [
    { from: "s", read: BLANK, write: BLANK, move: "S", to: "qa" },
    { from: "s", read: "a", write: BLANK, move: "R", to: "ra" },
    { from: "s", read: "b", write: BLANK, move: "R", to: "rb" },

    { from: "ra", read: "a", write: "a", move: "R", to: "ra" },
    { from: "ra", read: "b", write: "b", move: "R", to: "ra" },
    { from: "ra", read: BLANK, write: BLANK, move: "L", to: "backA" },
    { from: "rb", read: "a", write: "a", move: "R", to: "rb" },
    { from: "rb", read: "b", write: "b", move: "R", to: "rb" },
    { from: "rb", read: BLANK, write: BLANK, move: "L", to: "backB" },

    { from: "backA", read: "a", write: BLANK, move: "L", to: "home" },
    { from: "backA", read: "b", write: "b", move: "S", to: "qr" },
    { from: "backA", read: BLANK, write: BLANK, move: "S", to: "qa" },
    { from: "backB", read: "b", write: BLANK, move: "L", to: "home" },
    { from: "backB", read: "a", write: "a", move: "S", to: "qr" },
    { from: "backB", read: BLANK, write: BLANK, move: "S", to: "qa" },

    { from: "home", read: "a", write: "a", move: "L", to: "home" },
    { from: "home", read: "b", write: "b", move: "L", to: "home" },
    { from: "home", read: BLANK, write: BLANK, move: "R", to: "s" },
  ],
};

/** A deliberate non-halter: shows the step cap doing its job. */
const runaway: TMJSON = {
  states: ["go", "qa", "qr"],
  inputAlphabet: ["0", "1"],
  tapeAlphabet: ["0", "1", BLANK],
  startState: "go",
  acceptState: "qa",
  rejectState: "qr",
  rules: [
    { from: "go", read: "0", write: "1", move: "R", to: "go" },
    { from: "go", read: "1", write: "0", move: "R", to: "go" },
    { from: "go", read: BLANK, write: "0", move: "R", to: "go" },
  ],
};

export const TM_PRESETS: TMPreset[] = [
  {
    id: "anbncn",
    name: "aⁿbⁿcⁿ",
    formal: "L = { aⁿbⁿcⁿ : n ≥ 0 }",
    intuition:
      "Not even context-free — no stack machine can do it. The tape can, by crossing off one a, one b and one c per sweep.",
    tm: anbncn,
    samples: [
      { str: "abc", inLanguage: true },
      { str: "aabbcc", inLanguage: true },
      { str: "aabbc", inLanguage: false },
      { str: "abcc", inLanguage: false },
    ],
  },
  {
    id: "palindrome",
    name: "Palindromes over {a,b}",
    formal: "L = { w : w = wᴿ }",
    intuition: "Erase the first symbol, walk to the end, and demand the same symbol there.",
    tm: palindrome,
    samples: [
      { str: "abba", inLanguage: true },
      { str: "aba", inLanguage: true },
      { str: "abab", inLanguage: false },
      { str: "aab", inLanguage: false },
    ],
  },
  {
    id: "increment",
    name: "Binary increment (transducer)",
    formal: "f(w) = w + 1 in binary",
    intuition: "Not a recogniser — read the answer off the TAPE when it halts, not the state.",
    tm: increment,
    samples: [
      { str: "1011", inLanguage: true },
      { str: "111", inLanguage: true },
      { str: "0", inLanguage: true },
      { str: "", inLanguage: true },
    ],
  },
  {
    id: "runaway",
    name: "Runaway (never halts)",
    formal: "undefined — this machine loops forever",
    intuition:
      "The point of the step cap: undecidability is real, so the simulator gives up loudly instead of hanging.",
    tm: runaway,
    samples: [
      { str: "0", inLanguage: false },
      { str: "101", inLanguage: false },
    ],
  },
];

export function findTMPreset(id: string): TMPreset | null {
  const want = id.trim().toLowerCase();
  return TM_PRESETS.find((p) => p.id === want || p.name.toLowerCase() === want) ?? null;
}
