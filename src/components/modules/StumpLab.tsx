/**
 * Feature 24 — "Stump the machine".
 *
 * Role reversal. The student builds a DFA for a target language; the tutor (or
 * the engine) throws candidate counterexamples at it. Every attack is judged by
 * src/lib/engine/attack.ts against the reference DFA — the model never gets to
 * declare a hit, it only proposes strings.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, RotateCcw, ShieldCheck, Swords } from "lucide-react";
import { toast } from "sonner";
import { DFACanvas, type CanvasMode } from "@/components/DFACanvas";
import { CanvasToolbar } from "@/components/CanvasToolbar";
import { ChallengePicker } from "@/components/ChallengePicker";
import { FIXED_CHALLENGES, type Challenge } from "@/lib/engine/challenges";
import {
  applyResult,
  attackCategory,
  emptyScore,
  engineAttack,
  judgeAttack,
  probeString,
  type ArenaScore,
  type AttackResult,
} from "@/lib/engine/attack";
import { layoutMachine, machineToDFA, starterMachine, useMachine } from "@/lib/machine";
import { Storage } from "@/lib/storage";
import { onTutorAction } from "@/lib/tutor/actions";

interface Props {
  active?: boolean;
  onContext?: (fn: () => string) => void;
}

export function StumpLab({ onContext }: Props) {
  const [challenge, setChallenge] = useState<Challenge>(FIXED_CHALLENGES[0]!);
  const [mode, setMode] = useState<CanvasMode>("pointer");
  const [score, setScore] = useState<ArenaScore>(emptyScore());
  const [log, setLog] = useState<AttackResult[]>([]);
  const [manual, setManual] = useState("");
  const { machine, commit, set, replace, undo, redo, canUndo, canRedo } =
    useMachine(starterMachine());

  const alphabet = challenge.alphabet;
  const student = useMemo(() => machineToDFA(machine, alphabet), [machine, alphabet]);
  const ref = challenge.dfa;
  const tried = useMemo(() => new Set(log.map((l) => l.string)), [log]);
  /** Kept in a ref so the tutor listener never reads a stale attempt set. */
  const stateRef = useRef({ student, ref, tried });
  stateRef.current = { student, ref, tried };

  const record = useCallback((r: AttackResult) => {
    setLog((l) => [r, ...l].slice(0, 60));
    if (r.invalid) return;
    setScore((sc) => applyResult(sc, r));
    if (r.landed) {
      Storage.appendMistake(
        attackCategory(stateRef.current.ref, stateRef.current.student, r),
        `stump:${r.string || "eps"}`,
        `Attack "${r.string || "ε"}" landed: language says ${r.expected}, machine says ${r.got}.`,
      );
    }
  }, []);

  const fire = useCallback(
    (raw: string) => {
      const { ref: r0, student: s0, tried: t0 } = stateRef.current;
      const result = judgeAttack(r0, s0, raw, { tried: t0 });
      record(result);
      if (result.invalid) toast.error(result.invalid);
      else if (result.landed)
        toast.error(`Hit — "${raw || "ε"}" should ${result.expected}, your machine says ${result.got}.`);
      else toast.success(`Survived "${raw || "ε"}".`);
      return result;
    },
    [record],
  );

  const engineRound = useCallback(() => {
    const { ref: r0, student: s0, tried: t0 } = stateRef.current;
    const next = engineAttack(r0, s0, t0) ?? probeString(r0, t0);
    if (next === null) {
      toast.success("The engine is out of untried strings — your machine is holding.");
      return;
    }
    fire(next);
  }, [fire]);

  const reset = (c: Challenge = challenge) => {
    setChallenge(c);
    setScore(emptyScore());
    setLog([]);
    setManual("");
    replace(starterMachine());
  };

  /* ── tutor attacks ─────────────────────────────────────────── */
  useEffect(() => onTutorAction("attack", (a) => fire(a.value)), [fire]);

  /* ── tutor context ─────────────────────────────────────────── */
  useEffect(() => {
    onContext?.(() =>
      [
        `Module: Stump the machine (adversarial arena). Target language: ${challenge.name} — ${challenge.description}. Σ = {${alphabet.join(",")}}.`,
        `Student's machine: ${machine.states.length} state(s), ${machine.transitions.length} transition(s), ${student.isComplete() ? "complete" : "INCOMPLETE (missing transitions)"}.`,
        `Score: ${score.survived} survived, ${score.landed} hits taken, current streak ${score.streak}, best ${score.bestStreak}.`,
        `Already tried: ${[...tried].slice(0, 20).map((s) => `"${s || "ε"}"`).join(", ") || "nothing"}.`,
        'Your role: ATTACKER. Propose ONE candidate counterexample per turn with <IALE_ATTACK string="0110" taunt="…" />. The engine adjudicates — a wrong guess simply bounces, so aim at the boundary of the language rather than guessing randomly.',
        "HARD RULE: do not tell the student which state or transition is wrong, and never describe the correct machine. Attack with strings and ask what their machine did with them.",
      ].join("\n"),
    );
  }, [onContext, challenge, alphabet, machine, student, score, tried]);

  return (
    <div className="module-container">
      <aside className="module-panel-left" style={{ width: 340, flexShrink: 0 }}>
        <div>
          <span className="badge" data-tone="amber">
            Stump the machine
          </span>
          <h2 className="mt-2 text-lg">Build it. Defend it.</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
            Construct a DFA for the target language, then survive attacks. Every attack string is
            verified against the real language before it counts.
          </p>
        </div>

        <div className="lab-card">
          <span className="section-label">Target</span>
          <p className="mt-1 text-xs">{challenge.description}</p>
          <p className="mt-2 text-[11px]" style={{ color: "var(--ink-disabled)" }}>
            Σ = {"{"}
            {alphabet.join(", ")}
            {"}"} · difficulty {challenge.difficulty}
          </p>
        </div>

        <div className="lab-card">
          <span className="section-label">Scoreboard</span>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <Stat label="Survived" value={score.survived} tone="cyan" />
            <Stat label="Hits taken" value={score.landed} tone="rose" />
            <Stat label="Streak" value={score.streak} tone="amber" />
            <Stat label="Best streak" value={score.bestStreak} tone="blue" />
          </div>
        </div>

        <div className="lab-card">
          <span className="section-label">Attack log</span>
          <div className="mt-1 flex max-h-60 flex-col gap-1 overflow-y-auto text-[11px]">
            {log.length ? (
              log.map((r, n) => (
                <span
                  key={`${r.string}-${n}`}
                  style={{
                    fontFamily: "var(--font-mono-family)",
                    color: r.invalid
                      ? "var(--ink-disabled)"
                      : r.landed
                        ? "var(--signal-rose)"
                        : "var(--signal-cyan)",
                  }}
                >
                  {r.invalid
                    ? `"${r.string || "ε"}" — ${r.invalid}`
                    : `"${r.string || "ε"}" — L says ${r.expected}, you say ${r.got}${r.landed ? " ✗" : " ✓"}`}
                </span>
              ))
            ) : (
              <span style={{ color: "var(--ink-disabled)" }}>
                No attacks yet. Build something, then let the engine or Socratic take a swing.
              </span>
            )}
          </div>
        </div>

        <ChallengePicker activeId={challenge.id} onPick={(c) => reset(c)} />
      </aside>

      <section className="workbench">
        <CanvasToolbar
          mode={mode}
          setMode={setMode}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onClear={() => replace(starterMachine())}
          onLayout={() => commit((m) => layoutMachine(m))}
          alphabet={alphabet}
        >
          <input
            className="field-input"
            style={{ width: 140 }}
            value={manual}
            placeholder="attack yourself…"
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                fire(manual.trim());
                setManual("");
              }
            }}
          />
          <button className="btn-ghost" onClick={engineRound}>
            <Crosshair size={13} className="mr-1 inline" />
            Engine attack
          </button>
          <button className="btn-primary" onClick={() => reset()}>
            <RotateCcw size={13} className="mr-1 inline" />
            New round
          </button>
        </CanvasToolbar>

        <DFACanvas
          machine={machine}
          onChange={commit}
          onTransientChange={set}
          alphabet={alphabet}
          mode={mode}
          exportName="stump"
        />

        <div
          className="flex min-h-[60px] items-center gap-2 px-4 py-3"
          style={{
            borderTop: `2px solid ${
              score.landed && log[0]?.landed ? "var(--signal-rose)" : "var(--signal-cyan)"
            }`,
            background: "color-mix(in srgb, var(--bg-panel) 70%, transparent)",
          }}
        >
          {log[0] ? (
            log[0].landed ? (
              <>
                <Swords size={15} style={{ color: "var(--signal-rose)" }} />
                <span className="text-xs">
                  "{log[0].string || "ε"}" got through. The language says{" "}
                  <strong>{log[0].expected}</strong>; your machine says{" "}
                  <strong>{log[0].got}</strong>. What memory is your machine missing?
                </span>
              </>
            ) : (
              <>
                <ShieldCheck size={15} style={{ color: "var(--signal-cyan)" }} />
                <span className="text-xs">
                  Held against "{log[0].string || "ε"}". Streak {score.streak}.
                </span>
              </>
            )
          ) : (
            <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
              Draw a machine for the target language, then press <em>Engine attack</em> — or ask
              Socratic to attack it.
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex flex-col">
      <span className="badge" data-tone={tone} style={{ alignSelf: "flex-start" }}>
        {value}
      </span>
      <span className="mt-1 text-[10px]" style={{ color: "var(--ink-disabled)" }}>
        {label}
      </span>
    </div>
  );
}
