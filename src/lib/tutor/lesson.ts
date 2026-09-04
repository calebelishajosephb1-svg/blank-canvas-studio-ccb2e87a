/**
 * Feature 23 — AI Lesson Mode.
 *
 * The tutor stops answering and starts directing: it emits a scripted lesson as
 * a block tag containing JSON beats. The app plays the script back and — this
 * is the point — the APP adjudicates. Every beat is validated here against a
 * closed vocabulary before a single pixel moves, and every student answer is
 * checked locally, never by trusting the model's say-so.
 *
 *   <IALE_LESSON>
 *   {"title":"Sinks","beats":[
 *     {"kind":"say","text":"Look at q2 — nothing leaves it."},
 *     {"kind":"do","tag":"<IALE_HIGHLIGHT_STATE state=\"q2\" color=\"rose\" />"},
 *     {"kind":"ask","text":"What do we call such a state?","expect":"sink","alts":["trap"]},
 *     {"kind":"choice","text":"Is it accepting?","options":["Yes","No"],"answer":1}
 *   ]}
 *   </IALE_LESSON>
 */

import { parseTutorActions, type TutorAction } from "./actions";

export type LessonBeat =
  | { kind: "say"; text: string }
  | { kind: "do"; text: string; actions: TutorAction[] }
  | { kind: "ask"; text: string; expect: string; alts: string[]; hint: string }
  | { kind: "choice"; text: string; options: string[]; answer: number; hint: string };

export interface Lesson {
  title: string;
  beats: LessonBeat[];
}

const LESSON_BLOCK = /<IALE_LESSON\s*>([\s\S]*?)<\/IALE_LESSON\s*>/i;

/** Beats a single lesson may contain — anything else is dropped. */
const KINDS = new Set(["say", "do", "ask", "choice"]);

const MAX_BEATS = 14;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function toBeat(raw: unknown): LessonBeat | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = str(o["kind"]).toLowerCase();
  if (!KINDS.has(kind)) return null;

  if (kind === "say") {
    const text = str(o["text"]) || str(o["say"]);
    return text ? { kind: "say", text: text.slice(0, 600) } : null;
  }

  if (kind === "do") {
    // The tag must survive the normal action registry — no new trust surface.
    const tag = str(o["tag"]) || str(o["action"]);
    const { actions } = parseTutorActions(tag);
    if (!actions.length) return null;
    return { kind: "do", text: str(o["text"]).slice(0, 300), actions };
  }

  if (kind === "ask") {
    const text = str(o["text"]) || str(o["ask"]);
    const expect = str(o["expect"]);
    if (!text || !expect) return null;
    const alts = Array.isArray(o["alts"]) ? o["alts"].map(str).filter(Boolean).slice(0, 6) : [];
    return { kind: "ask", text: text.slice(0, 400), expect, alts, hint: str(o["hint"]).slice(0, 300) };
  }

  const text = str(o["text"]) || str(o["ask"]);
  const options = Array.isArray(o["options"]) ? o["options"].map(str).filter(Boolean) : [];
  const answer = Math.floor(Number(o["answer"]));
  if (!text || options.length < 2 || options.length > 5) return null;
  if (!Number.isFinite(answer) || answer < 0 || answer >= options.length) return null;
  return { kind: "choice", text: text.slice(0, 400), options, answer, hint: str(o["hint"]).slice(0, 300) };
}

/**
 * Pull a lesson out of a model reply. Returns the reply with the block removed
 * so the prose still reads normally when the lesson is malformed.
 */
export function parseLesson(text: string): { cleanText: string; lesson: Lesson | null } {
  const match = LESSON_BLOCK.exec(text);
  if (!match) return { cleanText: text, lesson: null };
  const cleanText = text.replace(LESSON_BLOCK, "").trim();

  let data: unknown;
  try {
    data = JSON.parse((match[1] ?? "").replace(/^\s*```(?:json)?|```\s*$/g, "").trim());
  } catch {
    return { cleanText, lesson: null };
  }
  if (!data || typeof data !== "object") return { cleanText, lesson: null };
  const o = data as Record<string, unknown>;
  const beats = Array.isArray(o["beats"])
    ? (o["beats"].map(toBeat).filter(Boolean) as LessonBeat[]).slice(0, MAX_BEATS)
    : [];
  if (!beats.length) return { cleanText, lesson: null };
  // A lesson with no question is just prose — require at least one checkpoint.
  if (!beats.some((b) => b.kind === "ask" || b.kind === "choice"))
    return { cleanText, lesson: null };
  return { cleanText, lesson: { title: str(o["title"]) || "Guided lesson", beats } };
}

/** Answer normalisation: forgiving about case, spacing and ε spellings. */
export function normalizeAnswer(s: string): string {
  const t = s.trim().toLowerCase().replace(/\s+/g, " ");
  if (t === "epsilon" || t === "empty string" || t === "lambda") return "ε";
  return t;
}

/** Engine-side grading. The model never decides whether the student was right. */
export function gradeAnswer(beat: LessonBeat, given: string): boolean {
  if (beat.kind === "ask") {
    const g = normalizeAnswer(given);
    if (!g) return false;
    return [beat.expect, ...beat.alts].some((e) => {
      const n = normalizeAnswer(e);
      return g === n || (n.length > 3 && g.includes(n));
    });
  }
  if (beat.kind === "choice") return Number(given) === beat.answer;
  return true;
}

export function lessonCheckpoints(lesson: Lesson): number {
  return lesson.beats.filter((b) => b.kind === "ask" || b.kind === "choice").length;
}
