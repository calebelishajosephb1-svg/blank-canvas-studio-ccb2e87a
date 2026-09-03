/**
 * Feature 20 — Proof Assistant: "prove L is not regular".
 *
 * A tile-by-tile proof builder. The student advances through the six canonical
 * steps of a pumping-lemma proof; the engine validates each move, and the
 * decisive step is universal: the chosen exponent must break EVERY legal
 * decomposition, not just the one an adversary happens to offer.
 */
import { useEffect, useMemo, useState } from "react";
import { Check, Download, RotateCcw, ScrollText, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  PUMPING_LANGUAGES,
  buildPumpingLanguage,
  legalSplits,
  pump,
  splitLabel,
  type PumpingLanguage,
  type Split,
} from "@/lib/engine/pumping";
import {
  PROOF_SCRIPT,
  checkUniversalPump,
  renderProof,
  sIsWinnable,
  validateP,
  validateS,
  validateSplit,
  type ProofContext,
  type ProofStepId,
  type UniversalCheck,
} from "@/lib/engine/proof";
import { Storage } from "@/lib/storage";
import { onTutorAction } from "@/lib/tutor/actions";

interface Props {
  active?: boolean;
  onContext?: (fn: () => string) => void;
}

export function ProofLab({ onContext }: Props) {
  const [authored, setAuthored] = useState<PumpingLanguage[]>([]);
  const languages = useMemo(() => [...PUMPING_LANGUAGES, ...authored], [authored]);
  const [langIndex, setLangIndex] = useState(0);
  const lang = languages[langIndex] ?? languages[0]!;

  const [done, setDone] = useState<ProofStepId[]>([]);
  const [p, setP] = useState<number | null>(null);
  const [sInput, setSInput] = useState("");
  const [s, setS] = useState("");
  const [iInput, setIInput] = useState("2");
  const [i, setI] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [check, setCheck] = useState<UniversalCheck | null>(null);
  /** Illegal decompositions the tutor tried to sneak past the student. */
  const [objections, setObjections] = useState<string[]>([]);

  const stepIndex = done.length;
  const current = PROOF_SCRIPT[stepIndex];
  const ctx: ProofContext = { lang, p, s, i };

  const reset = (index = langIndex) => {
    setLangIndex(index);
    setDone([]);
    setP(null);
    setSInput("");
    setS("");
    setIInput("2");
    setI(null);
    setNote(null);
    setCheck(null);
    setObjections([]);
  };

  const advance = (id: ProofStepId) => setDone((d) => (d.includes(id) ? d : [...d, id]));

  /* ── step actions ───────────────────────────────────────────── */

  const commitAssume = () => {
    advance("assume");
    setNote(null);
  };

  const commitP = (value: number) => {
    const r = validateP(value);
    setNote(r.message);
    if (!r.ok) return;
    setP(r.p);
    advance("obtain-p");
  };

  const commitS = () => {
    if (p === null) return;
    const candidate = sInput.trim();
    const r = validateS(lang, candidate, p);
    setNote(r.message);
    if (!r.ok) return;
    setS(candidate);
    advance("choose-s");
    if (!sIsWinnable(lang, candidate, p))
      toast.warning(
        "That s is legal, but no single exponent breaks every decomposition of it. You may want a different s.",
      );
  };

  const commitQuantify = () => {
    advance("quantify");
    setNote(null);
  };

  const commitPump = () => {
    if (p === null || !s) return;
    const n = Math.max(0, Math.min(6, Math.floor(Number(iInput) || 0)));
    const result = checkUniversalPump(lang, s, p, n);
    setCheck(result);
    setNote(result.message);
    setI(n);
    if (result.ok) {
      advance("pump");
      advance("conclude");
      Storage.recordSolve("proof", lang.id, 1);
      toast.success("Proof closed — every decomposition falls.");
    } else {
      Storage.appendMistake(
        "pumping",
        lang.id,
        `Exponent i=${n} left ${result.survivors.length} decomposition(s) of "${s}" inside ${lang.name}.`,
      );
    }
  };

  const exportProof = () => {
    const splits = p && s ? legalSplits(s, p).length : 0;
    const blob = new Blob([renderProof(ctx, splits)], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `proof-${lang.id}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /* ── tutor adversary ────────────────────────────────────────── */

  useEffect(
    () =>
      onTutorAction("pumpingLanguage", (a) => {
        const built = buildPumpingLanguage(a.kind, a.symbols, a.name);
        if (!built) return;
        setAuthored((list) => {
          const next = [...list.filter((l) => l.id !== built.id), built];
          setLangIndex(PUMPING_LANGUAGES.length + next.length - 1);
          return next;
        });
      }),
    [],
  );

  useEffect(
    () =>
      onTutorAction("proofMove", (a) => {
        if (a.move === "set-p") {
          const r = validateP(a.p);
          if (!r.ok) {
            setObjections((o) => [...o, `Adversary proposed an illegal p — ${r.message}`]);
            toast.error("Adversary proposed an illegal pumping length. Rejected.");
            return;
          }
          if (!done.includes("assume")) advance("assume");
          setP(r.p);
          advance("obtain-p");
          toast(`Adversary commits to p = ${r.p}.`);
          return;
        }
        if (a.move === "split") {
          if (p === null || !s) {
            toast.error("Adversary offered a decomposition before s was chosen. Ignored.");
            return;
          }
          const split: Split = { x: a.x, y: a.y, z: a.z };
          const r = validateSplit(split, s, p);
          if (!r.ok) {
            setObjections((o) => [...o, `Illegal decomposition ${splitLabel(split)} — ${r.message}`]);
            toast.error("That decomposition breaks the lemma's own rules. Called out.");
            return;
          }
          setObjections((o) => [
            ...o,
            `Adversary offers ${splitLabel(split)} (legal). Your exponent must kill this one too.`,
          ]);
          return;
        }
        if (a.move === "objection" && a.text) setObjections((o) => [...o, `Adversary: ${a.text}`]);
        if (a.move === "concede") setObjections((o) => [...o, "Adversary concedes the step."]);
      }),
    [done, p, s],
  );

  /* ── tutor context ──────────────────────────────────────────── */

  useEffect(() => {
    onContext?.(() =>
      [
        `Module: Proof Assistant. Target: prove ${lang.formal} is NOT regular (there is no automaton for it).`,
        `Proof steps completed: ${done.join(", ") || "none"}. Current step: ${current?.id ?? "finished"}.`,
        `p = ${p ?? "not fixed"}. s = "${s || "not chosen"}". Exponent tried: ${i ?? "none"}.`,
        check
          ? `Last universal check: ${check.broken}/${check.total} decompositions broken.`
          : "No exponent submitted yet.",
        'You play the ADVERSARY here. Moves: <IALE_PROOF_MOVE move="set-p" p="5" />, <IALE_PROOF_MOVE move="split" x="" y="aa" z="abb" />, <IALE_PROOF_MOVE move="objection" text="…" />, <IALE_PROOF_MOVE move="concede" />. Every move is re-validated by the engine, so do not bother with illegal ones.',
        "HARD RULE: never hand the student a string s and never name the exponent i. Press on the universal quantifier: ask whether their exponent survives EVERY decomposition, and what |xy| ≤ p forces y to be made of.",
      ].join("\n"),
    );
  }, [onContext, lang, done, current, p, s, i, check]);

  const splitsTotal = p && s ? legalSplits(s, p).length : 0;

  return (
    <div className="module-container">
      <aside className="module-panel-left" style={{ width: 340, flexShrink: 0 }}>
        <div>
          <span className="badge" data-tone="rose">
            Proof Assistant
          </span>
          <h2 className="mt-2 text-lg">Prove it's not regular</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
            Six steps, checked one at a time. The last one is the hard one: your exponent has to
            beat <em>every</em> legal decomposition.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <span className="section-label">Language</span>
          {languages.map((l, idx) => (
            <button
              key={l.id}
              className="tape-row"
              data-verdict={idx === langIndex ? "accept" : undefined}
              onClick={() => reset(idx)}
            >
              <span>{l.name}</span>
              <span style={{ color: "var(--ink-disabled)" }}>Σ={l.alphabet.join(",")}</span>
            </button>
          ))}
        </div>

        <div className="lab-card">
          <span className="section-label">Why it resists a DFA</span>
          <p className="mt-1 text-[11px]" style={{ color: "var(--ink-muted)" }}>
            {lang.intuition}
          </p>
        </div>

        {objections.length > 0 && (
          <div className="lab-card">
            <span className="section-label">
              <ShieldAlert size={11} className="mr-1 inline" />
              Adversary log
            </span>
            <div className="mt-1 flex flex-col gap-1 text-[11px]">
              {objections.map((o, n) => (
                <span key={n} style={{ color: "var(--ink-muted)" }}>
                  {o}
                </span>
              ))}
            </div>
          </div>
        )}
      </aside>

      <section className="workbench">
        <div className="canvas-toolbar">
          <span className="badge" data-tone="rose">
            <ScrollText size={12} className="mr-1 inline" />
            step {Math.min(stepIndex + 1, PROOF_SCRIPT.length)} / {PROOF_SCRIPT.length}
          </span>
          {p !== null && (
            <span className="badge" data-tone="amber">
              p = {p}
            </span>
          )}
          {splitsTotal > 0 && (
            <span className="badge" data-tone="blue">
              {splitsTotal} decompositions
            </span>
          )}
          <div className="ml-auto flex gap-1">
            {done.includes("conclude") && (
              <button className="btn-ghost" onClick={exportProof}>
                <Download size={13} className="mr-1 inline" />
                Export proof
              </button>
            )}
            <button className="btn-ghost" onClick={() => reset()}>
              <RotateCcw size={13} className="mr-1 inline" />
              Restart
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            {PROOF_SCRIPT.map((step, idx) => {
              const isDone = done.includes(step.id);
              const isCurrent = idx === stepIndex;
              return (
                <div
                  key={step.id}
                  className="lab-card"
                  style={{ opacity: isDone || isCurrent ? 1 : 0.45 }}
                >
                  <div className="flex items-center gap-2">
                    <span className="badge" data-tone={isDone ? "cyan" : isCurrent ? "amber" : undefined}>
                      {isDone ? <Check size={11} /> : idx + 1}
                    </span>
                    <span className="section-label">{step.title}</span>
                  </div>
                  {(isDone || isCurrent) && (
                    <p
                      className="mt-2 text-xs"
                      style={{ fontFamily: "var(--font-mono-family)" }}
                    >
                      {step.claim(ctx)}
                    </p>
                  )}
                  {isCurrent && (
                    <>
                      <p className="mt-2 text-[11px]" style={{ color: "var(--ink-muted)" }}>
                        {step.nudge}
                      </p>
                      <div className="mt-2">
                        {step.id === "assume" && (
                          <button className="btn-primary" onClick={commitAssume}>
                            Assume L is regular
                          </button>
                        )}
                        {step.id === "obtain-p" && (
                          <div className="flex gap-2">
                            <button
                              className="btn-primary"
                              onClick={() => commitP(2 + Math.floor(Math.random() * 4))}
                            >
                              Let the adversary fix p
                            </button>
                            <span className="text-[11px] self-center" style={{ color: "var(--ink-disabled)" }}>
                              or ask Socratic to commit to one
                            </span>
                          </div>
                        )}
                        {step.id === "choose-s" && (
                          <div className="flex gap-2">
                            <input
                              className="field-input flex-1"
                              value={sInput}
                              placeholder={p ? lang.suggest(p)[0] : ""}
                              onChange={(e) => setSInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && commitS()}
                            />
                            <button className="btn-primary" onClick={commitS}>
                              Commit s
                            </button>
                          </div>
                        )}
                        {step.id === "quantify" && (
                          <div className="flex flex-col gap-2">
                            <SplitGallery lang={lang} s={s} p={p ?? 0} />
                            <button className="btn-primary self-start" onClick={commitQuantify}>
                              I'll handle all {splitsTotal} of them
                            </button>
                          </div>
                        )}
                        {step.id === "pump" && (
                          <div className="flex gap-2">
                            <input
                              className="field-input"
                              style={{ width: 90 }}
                              value={iInput}
                              onChange={(e) => setIInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && commitPump()}
                            />
                            <button className="btn-primary" onClick={commitPump}>
                              Pump with this i
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {note && (
              <div className="lab-card">
                <span className="section-label">Referee</span>
                <p className="mt-1 text-xs">{note}</p>
              </div>
            )}

            {check && !check.ok && check.survivors.length > 0 && (
              <div className="lab-card">
                <span className="section-label">Decompositions that survived</span>
                <div className="mt-1 flex flex-col gap-1 text-[11px]">
                  {check.survivors.map((sp, n) => (
                    <span key={n} style={{ fontFamily: "var(--font-mono-family)" }}>
                      {splitLabel(sp)} → xy<sup>{i}</sup>z = "{pump(sp, i ?? 0) || "ε"}" ∈ L
                    </span>
                  ))}
                </div>
              </div>
            )}

            {done.includes("conclude") && (
              <div className="lab-card">
                <span className="section-label">Completed proof</span>
                <pre
                  className="mt-2 whitespace-pre-wrap text-[11px]"
                  style={{ fontFamily: "var(--font-mono-family)" }}
                >
                  {renderProof(ctx, splitsTotal)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Shows a sample of the legal decompositions so the quantifier stops being abstract. */
function SplitGallery({ lang, s, p }: { lang: PumpingLanguage; s: string; p: number }) {
  const splits = useMemo(() => (s && p ? legalSplits(s, p) : []), [s, p]);
  if (!splits.length) return null;
  return (
    <div className="flex flex-col gap-1 text-[11px]">
      {splits.slice(0, 6).map((sp, n) => (
        <span key={n} style={{ fontFamily: "var(--font-mono-family)", color: "var(--ink-muted)" }}>
          {splitLabel(sp)}
          {lang.member(pump(sp, 2)) ? "  (survives i=2)" : ""}
        </span>
      ))}
      {splits.length > 6 && (
        <span style={{ color: "var(--ink-disabled)" }}>…and {splits.length - 6} more.</span>
      )}
    </div>
  );
}
