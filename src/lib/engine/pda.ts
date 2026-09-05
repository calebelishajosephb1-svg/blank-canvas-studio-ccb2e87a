/**
 * Pushdown automaton — pure, deterministic search, never throws.
 *
 * Nondeterministic by construction (ε-reads and multiple matching rules are
 * allowed); acceptance is decided by a breadth-first search over configurations
 * with a hard step cap, so a looping machine fails gracefully instead of
 * hanging the tab.
 */

export interface PDARule {
  from: string;
  /** Input symbol consumed, or "" for an ε-move. */
  read: string;
  /** Stack symbol popped, or "" to pop nothing. */
  pop: string;
  /** Symbols pushed, leftmost ends up on top. "" pushes nothing. */
  push: string;
  to: string;
}

export interface PDAJSON {
  states: string[];
  inputAlphabet: string[];
  stackAlphabet: string[];
  startState: string;
  /** Symbol the stack starts with (bottom marker). "" starts empty. */
  startStack: string;
  acceptStates: string[];
  acceptance: "final" | "empty";
  rules: PDARule[];
}

/** A machine configuration: where we are, what's left to read, what's stacked. */
export interface PDAConfig {
  state: string;
  /** Index into the input string. */
  pos: number;
  /** Top of stack is index 0. */
  stack: string[];
  /** Rule that produced this config (null for the initial one). */
  via: PDARule | null;
}

export const PDA_STEP_CAP = 6000;

const key = (c: PDAConfig) => `${c.state}|${c.pos}|${c.stack.join("")}`;

export function initialConfig(pda: PDAJSON): PDAConfig {
  return {
    state: pda.startState,
    pos: 0,
    stack: pda.startStack ? [pda.startStack] : [],
    via: null,
  };
}

function accepts(pda: PDAJSON, c: PDAConfig, input: string): boolean {
  if (c.pos !== input.length) return false;
  return pda.acceptance === "empty" ? c.stack.length === 0 : pda.acceptStates.includes(c.state);
}

/** Every configuration reachable from `c` in one rule application. */
export function successors(pda: PDAJSON, c: PDAConfig, input: string): PDAConfig[] {
  const out: PDAConfig[] = [];
  for (const r of pda.rules) {
    if (r.from !== c.state) continue;
    if (r.read && input[c.pos] !== r.read) continue;
    if (r.pop && c.stack[0] !== r.pop) continue;
    const stack = r.pop ? c.stack.slice(1) : [...c.stack];
    const pushed = r.push ? [...r.push] : [];
    out.push({
      state: r.to,
      pos: c.pos + (r.read ? 1 : 0),
      stack: [...pushed, ...stack],
      via: r,
    });
  }
  return out;
}

export interface PDARun {
  accepted: boolean;
  /** An accepting path when one exists, otherwise the deepest path explored. */
  path: PDAConfig[];
  /** Configurations expanded — a proxy for how hard the search worked. */
  explored: number;
  /** True when the step cap stopped the search before it was exhaustive. */
  capped: boolean;
}

export function runPDA(pda: PDAJSON, input: string, cap = PDA_STEP_CAP): PDARun {
  const start = initialConfig(pda);
  const parents = new Map<string, PDAConfig | null>();
  const configs = new Map<string, PDAConfig>();
  const queue: PDAConfig[] = [start];
  parents.set(key(start), null);
  configs.set(key(start), start);
  let explored = 0;
  let deepest = start;

  while (queue.length) {
    if (explored >= cap) return { accepted: false, path: rebuild(deepest), explored, capped: true };
    const cur = queue.shift()!;
    explored++;
    if (cur.pos > deepest.pos) deepest = cur;
    if (accepts(pda, cur, input)) return { accepted: true, path: rebuild(cur), explored, capped: false };
    for (const next of successors(pda, cur, input)) {
      // Bound the stack so a push-only ε-loop cannot grow forever.
      if (next.stack.length > input.length + 8) continue;
      const k = key(next);
      if (parents.has(k)) continue;
      parents.set(k, cur);
      configs.set(k, next);
      queue.push(next);
    }
  }
  return { accepted: false, path: rebuild(deepest), explored, capped: false };

  function rebuild(end: PDAConfig): PDAConfig[] {
    const path: PDAConfig[] = [];
    let cur: PDAConfig | null | undefined = end;
    const guard = new Set<string>();
    while (cur && !guard.has(key(cur))) {
      guard.add(key(cur));
      path.unshift(cur);
      cur = parents.get(key(cur)) ?? null;
    }
    return path;
  }
}

export function stackLabel(stack: string[]): string {
  return stack.length ? stack.join("") : "(empty)";
}

export function ruleLabel(r: PDARule): string {
  return `${r.read || "ε"}, ${r.pop || "ε"} → ${r.push || "ε"}`;
}

/** Sanity report used by the lab before running anything. */
export function validatePDA(pda: PDAJSON): string[] {
  const problems: string[] = [];
  if (!pda.states.length) problems.push("No states.");
  if (!pda.states.includes(pda.startState)) problems.push("Start state is not in the state set.");
  for (const r of pda.rules) {
    if (!pda.states.includes(r.from) || !pda.states.includes(r.to))
      problems.push(`Rule ${r.from}→${r.to} mentions an unknown state.`);
    if (r.read && !pda.inputAlphabet.includes(r.read))
      problems.push(`Rule ${r.from}→${r.to} reads "${r.read}", which is outside Σ.`);
  }
  if (pda.acceptance === "final" && !pda.acceptStates.length)
    problems.push("Acceptance is by final state but no state is accepting.");
  return problems;
}

export interface PDAPreset {
  id: string;
  name: string;
  formal: string;
  intuition: string;
  pda: PDAJSON;
  samples: { str: string; inLanguage: boolean }[];
}

/** Balanced parentheses over { (, ) } — acceptance by empty stack. */
const balanced: PDAJSON = {
  states: ["q"],
  inputAlphabet: ["(", ")"],
  stackAlphabet: ["("],
  startState: "q",
  startStack: "",
  acceptStates: [],
  acceptance: "empty",
  rules: [
    { from: "q", read: "(", pop: "", push: "(", to: "q" },
    { from: "q", read: ")", pop: "(", push: "", to: "q" },
  ],
};

/** aⁿbⁿ — push on a, pop on b, accept by final state. */
const anbn: PDAJSON = {
  states: ["q0", "q1", "qf"],
  inputAlphabet: ["a", "b"],
  stackAlphabet: ["A", "Z"],
  startState: "q0",
  startStack: "Z",
  acceptStates: ["qf"],
  acceptance: "final",
  rules: [
    { from: "q0", read: "a", pop: "Z", push: "AZ", to: "q0" },
    { from: "q0", read: "a", pop: "A", push: "AA", to: "q0" },
    { from: "q0", read: "b", pop: "A", push: "", to: "q1" },
    { from: "q1", read: "b", pop: "A", push: "", to: "q1" },
    { from: "q1", read: "", pop: "Z", push: "", to: "qf" },
    { from: "q0", read: "", pop: "Z", push: "", to: "qf" },
  ],
};

/** w c wᴿ over { a, b, c } — push until the marker, then match on the way out. */
const wcwr: PDAJSON = {
  states: ["p", "m", "f"],
  inputAlphabet: ["a", "b", "c"],
  stackAlphabet: ["a", "b", "Z"],
  startState: "p",
  startStack: "Z",
  acceptStates: ["f"],
  acceptance: "final",
  rules: [
    { from: "p", read: "a", pop: "", push: "a", to: "p" },
    { from: "p", read: "b", pop: "", push: "b", to: "p" },
    { from: "p", read: "c", pop: "", push: "", to: "m" },
    { from: "m", read: "a", pop: "a", push: "", to: "m" },
    { from: "m", read: "b", pop: "b", push: "", to: "m" },
    { from: "m", read: "", pop: "Z", push: "", to: "f" },
  ],
};

/** Equal a's and b's in any order — a counter machine on the stack. */
const equalAB: PDAJSON = {
  states: ["q", "f"],
  inputAlphabet: ["a", "b"],
  stackAlphabet: ["A", "B", "Z"],
  startState: "q",
  startStack: "Z",
  acceptStates: ["f"],
  acceptance: "final",
  rules: [
    { from: "q", read: "a", pop: "Z", push: "AZ", to: "q" },
    { from: "q", read: "a", pop: "A", push: "AA", to: "q" },
    { from: "q", read: "a", pop: "B", push: "", to: "q" },
    { from: "q", read: "b", pop: "Z", push: "BZ", to: "q" },
    { from: "q", read: "b", pop: "B", push: "BB", to: "q" },
    { from: "q", read: "b", pop: "A", push: "", to: "q" },
    { from: "q", read: "", pop: "Z", push: "", to: "f" },
  ],
};

/** Odd-length palindromes with a middle marker-free guess (nondeterminism!). */
const evenPalindrome: PDAJSON = {
  states: ["p", "m", "f"],
  inputAlphabet: ["a", "b"],
  stackAlphabet: ["a", "b", "Z"],
  startState: "p",
  startStack: "Z",
  acceptStates: ["f"],
  acceptance: "final",
  rules: [
    { from: "p", read: "a", pop: "", push: "a", to: "p" },
    { from: "p", read: "b", pop: "", push: "b", to: "p" },
    { from: "p", read: "", pop: "", push: "", to: "m" },
    { from: "m", read: "a", pop: "a", push: "", to: "m" },
    { from: "m", read: "b", pop: "b", push: "", to: "m" },
    { from: "m", read: "", pop: "Z", push: "", to: "f" },
  ],
};

export const PDA_PRESETS: PDAPreset[] = [
  {
    id: "balanced",
    name: "Balanced parentheses",
    formal: "L = { w ∈ {(,)}* : every prefix has #( ≥ #) and #( = #) overall }",
    intuition: "One state is enough: the stack is the counter. Acceptance is by empty stack.",
    pda: balanced,
    samples: [
      { str: "(())", inLanguage: true },
      { str: "()()", inLanguage: true },
      { str: "(()", inLanguage: false },
      { str: ")(", inLanguage: false },
    ],
  },
  {
    id: "anbn",
    name: "aⁿbⁿ",
    formal: "L = { aⁿbⁿ : n ≥ 0 }",
    intuition: "Push an A per a, pop one per b, then check the bottom marker Z is exposed.",
    pda: anbn,
    samples: [
      { str: "aabb", inLanguage: true },
      { str: "", inLanguage: true },
      { str: "aab", inLanguage: false },
      { str: "abab", inLanguage: false },
    ],
  },
  {
    id: "wcwr",
    name: "w c wᴿ",
    formal: "L = { w c wᴿ : w ∈ {a,b}* }",
    intuition: "The marker c tells the machine when to stop pushing and start matching.",
    pda: wcwr,
    samples: [
      { str: "abcba", inLanguage: true },
      { str: "c", inLanguage: true },
      { str: "abcab", inLanguage: false },
      { str: "ab", inLanguage: false },
    ],
  },
  {
    id: "equal",
    name: "Equal a's and b's",
    formal: "L = { w ∈ {a,b}* : #a(w) = #b(w) }",
    intuition: "The stack holds the running surplus; a and b cancel each other off the top.",
    pda: equalAB,
    samples: [
      { str: "abba", inLanguage: true },
      { str: "aabb", inLanguage: true },
      { str: "aab", inLanguage: false },
      { str: "b", inLanguage: false },
    ],
  },
  {
    id: "palindrome",
    name: "Even palindromes (nondeterministic)",
    formal: "L = { w wᴿ : w ∈ {a,b}* }",
    intuition:
      "No marker this time — the machine must GUESS the midpoint with an ε-move. Determinism is genuinely impossible here.",
    pda: evenPalindrome,
    samples: [
      { str: "abba", inLanguage: true },
      { str: "aa", inLanguage: true },
      { str: "aba", inLanguage: false },
      { str: "abab", inLanguage: false },
    ],
  },
];

export function findPDAPreset(id: string): PDAPreset | null {
  const want = id.trim().toLowerCase();
  return PDA_PRESETS.find((p) => p.id === want || p.name.toLowerCase() === want) ?? null;
}
