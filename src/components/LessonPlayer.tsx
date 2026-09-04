import { useEffect, useRef, useState } from "react";
import { GraduationCap, X, ChevronRight, Check, RotateCcw } from "lucide-react";
import { dispatchTutorActions } from "@/lib/tutor/actions";
import { gradeAnswer, lessonCheckpoints, type Lesson } from "@/lib/tutor/lesson";

/**
 * Feature 23 — plays a tutor-authored lesson script.
 *
 * The model choreographs; this component adjudicates. Question beats block
 * until the student answers, and correctness comes from `gradeAnswer`, never
 * from the reply text.
 */
export function LessonPlayer() {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<"none" | "right" | "wrong">("none");
  const [score, setScore] = useState({ right: 0, asked: 0 });
  const played = useRef(-1);

  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent<Lesson>).detail;
      if (!next?.beats?.length) return;
      played.current = -1;
      setLesson(next);
      setI(0);
      setAnswer("");
      setVerdict("none");
      setScore({ right: 0, asked: 0 });
    };
    window.addEventListener("iale-lesson", handler);
    return () => window.removeEventListener("iale-lesson", handler);
  }, []);

  const beat = lesson?.beats[i];

  // "do" beats fire their canvas actions exactly once, as the beat is entered.
  useEffect(() => {
    if (!beat || beat.kind !== "do" || played.current === i) return;
    played.current = i;
    dispatchTutorActions(beat.actions);
  }, [beat, i]);

  if (!lesson || !beat) return null;

  const total = lesson.beats.length;
  const checkpoints = lessonCheckpoints(lesson);
  const last = i === total - 1;

  const advance = () => {
    setAnswer("");
    setVerdict("none");
    if (last) setLesson(null);
    else setI((n) => n + 1);
  };

  const submit = (given: string) => {
    const ok = gradeAnswer(beat, given);
    setVerdict(ok ? "right" : "wrong");
    if (ok) setScore((s) => ({ right: s.right + 1, asked: s.asked + 1 }));
    else setScore((s) => ({ ...s, asked: s.asked + 1 }));
  };

  const asking = beat.kind === "ask" || beat.kind === "choice";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-2xl rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
        <div className="mb-2 flex items-center gap-2">
          <GraduationCap size={15} className="text-primary" />
          <span className="text-sm font-medium">{lesson.title}</span>
          <span className="badge">
            beat {i + 1}/{total}
          </span>
          {checkpoints > 0 && (
            <span className="badge">
              {score.right}/{checkpoints} correct
            </span>
          )}
          <button
            className="tool-btn ml-auto"
            title="End lesson"
            onClick={() => setLesson(null)}
          >
            <X size={14} />
          </button>
        </div>

        <div className="h-1 w-full overflow-hidden rounded bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((i + 1) / total) * 100}%` }}
          />
        </div>

        <p className="mt-3 text-sm leading-relaxed text-foreground">{beat.text || "…"}</p>

        {beat.kind === "choice" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {beat.options.map((opt, idx) => (
              <button
                key={idx}
                className="chip"
                data-active={verdict !== "none" && idx === beat.answer}
                onClick={() => submit(String(idx))}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {beat.kind === "ask" && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit(answer);
            }}
          >
            <input
              className="field-input flex-1"
              value={answer}
              placeholder="Your answer"
              onChange={(e) => setAnswer(e.target.value)}
            />
            <button className="btn-primary" type="submit">
              <Check size={14} /> Check
            </button>
          </form>
        )}

        {verdict === "wrong" && (
          <p className="mt-2 text-xs text-destructive">
            Not quite. {beat.kind !== "say" && beat.kind !== "do" && beat.hint ? beat.hint : "Try once more."}
          </p>
        )}
        {verdict === "right" && <p className="mt-2 text-xs text-primary">Correct.</p>}

        <div className="mt-3 flex items-center gap-2">
          {asking && verdict === "wrong" && (
            <button className="btn-ghost" onClick={() => setVerdict("none")}>
              <RotateCcw size={14} /> Retry
            </button>
          )}
          <button
            className="btn-primary ml-auto"
            disabled={asking && verdict !== "right"}
            onClick={advance}
          >
            {last ? "Finish" : "Next"} <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
