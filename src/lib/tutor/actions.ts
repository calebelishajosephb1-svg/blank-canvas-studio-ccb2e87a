/**
 * Tutor orchestration actions.
 *
 * Tags are self-closing (<IALE_TAG attr="v" />) and parsed out of the model's
 * prose. Everything is driven by a registry keyed on the tag name, so adding a
 * new capability means adding one entry here plus one listener in the module —
 * never editing a switch in three places.
 */

import { parseAlphabet } from "@/lib/alphabet";

export type TutorAction =
  | { type: "highlight"; state: string; color: "blue" | "rose" | "cyan" | "amber" }
  | {
      type: "highlightTransition";
      from: string;
      to: string;
      color: "blue" | "rose" | "cyan" | "amber";
    }
  | { type: "annotateState"; state: string }
  | { type: "isolateSymbol"; symbol: string }
  | { type: "zoomTo"; state: string }
  | { type: "simplifyLayout" }
  | { type: "linkConcept"; tab: string; label: string }
  | { type: "test"; value: string }
  | { type: "animate"; value: string }
  | { type: "animateElimination"; state: string }
  | { type: "animateSubsetStep"; set: string }
  | { type: "hintLevel"; level: number }
  | { type: "adjustDifficulty"; direction: "up" | "down" }
  | { type: "streakNudge" }
  | { type: "celebrate" }
  | { type: "gotoTab"; tab: string }
  | { type: "showExample"; str: string; accept: boolean }
  | { type: "readAloud"; text: string }
  | { type: "sketch"; title: string; spec: string }
  | { type: "exportNotes" }
  | { type: "describeCanvas" }
  | { type: "showRecommendations" }
  | { type: "challenge"; name: string; regex: string; difficulty: string; alphabet: string[] }
  | { type: "pumpingLanguage"; kind: string; symbols: string[]; name: string }
  | {
      type: "proofMove";
      move: "set-p" | "split" | "objection" | "concede";
      p: number | null;
      x: string;
      y: string;
      z: string;
      text: string;
    }
  | { type: "attack"; value: string; taunt: string }
  | { type: "pdaChallenge"; preset: string; input: string }
  | { type: "stackStep"; value: string }
  | { type: "tmChallenge"; preset: string; input: string }
  | { type: "tapeWrite"; value: string; run: boolean }
  | {
      type: "setConversion";
      source: string;
      target: string;
      alphabet: string[];
      regex: string | null;
      run: boolean;
    };

const TAG = /<IALE_([A-Z_]+)([^>]*)\/>/g;
const TONES = ["blue", "rose", "cyan", "amber"] as const;
type Tone = (typeof TONES)[number];
const tone = (v?: string): Tone =>
  v && (TONES as readonly string[]).includes(v) ? (v as Tone) : "blue";

function attrs(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/(\w+)\s*=\s*"([^"]*)"/g)) out[m[1] ?? ""] = m[2] ?? "";
  return out;
}

type Builder = (a: Record<string, string>) => TutorAction | null;

/** Tag name -> action builder. Returning null drops a malformed tag silently. */
export const ACTION_REGISTRY: Record<string, Builder> = {
  HIGHLIGHT_STATE: (a) =>
    a["state"] ? { type: "highlight", state: a["state"], color: tone(a["color"]) } : null,
  HIGHLIGHT_TRANSITION: (a) =>
    a["from"] && a["to"]
      ? { type: "highlightTransition", from: a["from"], to: a["to"], color: tone(a["color"]) }
      : null,
  ANNOTATE_STATE: (a) => (a["state"] ? { type: "annotateState", state: a["state"] } : null),
  ISOLATE_SYMBOL: (a) => (a["symbol"] ? { type: "isolateSymbol", symbol: a["symbol"] } : null),
  ZOOM_TO: (a) => (a["state"] ? { type: "zoomTo", state: a["state"] } : null),
  SIMPLIFY_LAYOUT: () => ({ type: "simplifyLayout" }),
  LINK_CONCEPT: (a) =>
    a["tab"]
      ? { type: "linkConcept", tab: a["tab"], label: a["label"] || `Open ${a["tab"]}` }
      : null,
  TEST_STRING: (a) => (a["value"] !== undefined ? { type: "test", value: a["value"] } : null),
  ANIMATE_TRACE: (a) => (a["value"] !== undefined ? { type: "animate", value: a["value"] } : null),
  ANIMATE_ELIMINATION: (a) =>
    a["state"] ? { type: "animateElimination", state: a["state"] } : null,
  ANIMATE_SUBSET_STEP: (a) => (a["set"] ? { type: "animateSubsetStep", set: a["set"] } : null),
  SET_HINT_LEVEL: (a) => ({
    type: "hintLevel",
    level: Math.min(3, Math.max(1, Number(a["level"]) || 1)),
  }),
  ADJUST_DIFFICULTY: (a) => ({
    type: "adjustDifficulty",
    direction: a["direction"] === "down" ? "down" : "up",
  }),
  STREAK_NUDGE: () => ({ type: "streakNudge" }),
  CELEBRATE: () => ({ type: "celebrate" }),
  GOTO_TAB: (a) => (a["tab"] ? { type: "gotoTab", tab: a["tab"] } : null),
  SHOW_EXAMPLE: (a) =>
    a["str"] !== undefined
      ? { type: "showExample", str: a["str"], accept: a["accept"] !== "false" }
      : null,
  READ_ALOUD_SUMMARY: (a) => (a["text"] ? { type: "readAloud", text: a["text"] } : null),
  EXPORT_SESSION_NOTES: () => ({ type: "exportNotes" }),
  // Accessibility: narrates only what is already drawn on the canvas.
  DESCRIBE_CANVAS: () => ({ type: "describeCanvas" }),
  // Motivation: re-surfaces the Analytics recommendation cards inside the chat.
  SHOW_RECOMMENDATIONS: () => ({ type: "showRecommendations" }),
  // Scratch sketch: illustrative dummy machine only (tier: PUBLIC by
  // construction — it never receives the student's real machine).
  SKETCH: (a) =>
    a["spec"] ? { type: "sketch", title: a["title"] || "generic example", spec: a["spec"] } : null,
  CHALLENGE: (a) => {
    if (!a["regex"]) return null;
    // Accept "abc", "a,b,c" or "a b c"; default to binary. Multi-character
    // symbols must be comma-separated so parseAlphabet keeps them intact.
    const alphabet = a["alphabet"] ? parseAlphabet(a["alphabet"]) : ["0", "1"];
    return alphabet.length
      ? {
          type: "challenge",
          name: a["name"] || `Practice: ${a["regex"]}`,
          regex: a["regex"]!,
          difficulty: a["difficulty"] || "Easy",
          alphabet,
        }
      : null;
  },
  // Pumping lemma: instantiate a non-regular language from a closed vocabulary
  // of kinds over any symbols the tutor chooses.
  PUMPING_LANGUAGE: (a) => {
    if (!a["kind"]) return null;
    const symbols = parseAlphabet(a["symbols"] || a["alphabet"] || "ab");
    return symbols.length
      ? { type: "pumpingLanguage", kind: a["kind"].toLowerCase(), symbols, name: a["name"] || "" }
      : null;
  },
  // Proof Assistant: the tutor plays the adversary. Every move is re-validated
  // by src/lib/engine/proof.ts, so an illegal p or decomposition is caught.
  PROOF_MOVE: (a) => {
    const moves = ["set-p", "split", "objection", "concede"] as const;
    const move = (a["move"] || "").toLowerCase() as (typeof moves)[number];
    if (!(moves as readonly string[]).includes(move)) return null;
    const p = a["p"] !== undefined ? Math.floor(Number(a["p"])) : null;
    return {
      type: "proofMove",
      move,
      p: p !== null && Number.isFinite(p) ? p : null,
      x: a["x"] ?? "",
      y: a["y"] ?? "",
      z: a["z"] ?? "",
      text: a["text"] ?? "",
    };
  },
  // Stump the machine: propose a candidate counterexample. The engine decides
  // whether it actually lands.
  ATTACK: (a) =>
    a["string"] !== undefined || a["value"] !== undefined
      ? { type: "attack", value: a["string"] ?? a["value"] ?? "", taunt: a["taunt"] ?? "" }
      : null,
  // PDA lab: load one of the built-in stack machines and (optionally) a string.
  PDA_CHALLENGE: (a) =>
    a["preset"] ? { type: "pdaChallenge", preset: a["preset"], input: a["input"] ?? "" } : null,
  // PDA lab: run a string and step the stack for the student.
  STACK_STEP: (a) => (a["value"] !== undefined ? { type: "stackStep", value: a["value"] } : null),
  // TM lab: load one of the built-in tape machines.
  TM_CHALLENGE: (a) =>
    a["preset"] ? { type: "tmChallenge", preset: a["preset"], input: a["input"] ?? "" } : null,
  // TM lab: write a string onto the tape; run="false" leaves it un-executed.
  TAPE_WRITE: (a) =>
    a["value"] !== undefined
      ? { type: "tapeWrite", value: a["value"], run: a["run"] !== "false" }
      : null,
  TM_TRACE: (a) =>
    a["value"] !== undefined ? { type: "tapeWrite", value: a["value"], run: true } : null,
  // Converter: set up (and optionally run) a conversion for the student.
  SET_CONVERSION: (a) => {
    const reps = ["dfa", "nfa", "enfa", "regex"];
    const source = (a["source"] || "").toLowerCase();
    const target = (a["target"] || "").toLowerCase();
    if (!reps.includes(source) || !reps.includes(target) || source === target) return null;
    return {
      type: "setConversion",
      source,
      target,
      alphabet: a["alphabet"] ? parseAlphabet(a["alphabet"]) : [],
      regex: a["regex"] ?? null,
      run: a["run"] !== "false",
    };
  },
};


export function parseTutorActions(text: string): { cleanText: string; actions: TutorAction[] } {
  const actions: TutorAction[] = [];
  const cleanText = text
    .replace(TAG, (_full, tag: string, rest: string) => {
      const build = ACTION_REGISTRY[tag];
      if (build) {
        const action = build(attrs(rest));
        if (action) actions.push(action);
      }
      return "";
    })
    .trim();
  // At most one challenge per turn; attention-only actions do not count toward
  // the two-tool budget, since they never carry content.
  const firstChallenge = actions.findIndex((x) => x.type === "challenge");
  const filtered = actions.filter((x, i) => x.type !== "challenge" || i === firstChallenge);
  const cosmetic = new Set([
    "annotateState",
    "isolateSymbol",
    "zoomTo",
    "simplifyLayout",
    "linkConcept",
    "readAloud",
    "sketch",
    "describeCanvas",
    "showRecommendations",
  ]);
  const budgeted: TutorAction[] = [];
  let spent = 0;
  for (const a of filtered) {
    if (cosmetic.has(a.type)) budgeted.push(a);
    else if (spent < 2) {
      budgeted.push(a);
      spent++;
    }
  }
  return { cleanText, actions: budgeted };
}

export function dispatchTutorActions(actions: TutorAction[]) {
  if (typeof window === "undefined") return;
  for (const action of actions) {
    window.dispatchEvent(new CustomEvent("iale-tutor-action", { detail: action }));
    window.dispatchEvent(new CustomEvent(`iale-${kebab(action.type)}`, { detail: action }));
  }
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Subscribe to a single action type. Returns an unsubscribe function. */
export function onTutorAction<T extends TutorAction["type"]>(
  type: T,
  handler: (action: Extract<TutorAction, { type: T }>) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const detail = (e as CustomEvent).detail as TutorAction;
    if (detail?.type === type) handler(detail as Extract<TutorAction, { type: T }>);
  };
  window.addEventListener("iale-tutor-action", listener);
  return () => window.removeEventListener("iale-tutor-action", listener);
}
