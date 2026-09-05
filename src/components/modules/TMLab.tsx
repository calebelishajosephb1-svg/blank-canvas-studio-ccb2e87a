import { useEffect, useMemo, useState } from "react";
import {
  BLANK,
  TM_PRESETS,
  TM_STEP_CAP,
  findTMPreset,
  runTM,
  tmRuleLabel,
  validateTM,
  type TMPreset,
} from "@/lib/engine/tm";
import { Storage } from "@/lib/storage";
import { onTutorAction } from "@/lib/tutor/actions";
import { toast } from "sonner";
import { Play, RotateCcw, SkipBack, SkipForward, Tally5 } from "lucide-react";

interface Props {
  active?: boolean;
  onContext?: (fn: () => string) => void;
}

const HALT_TEXT: Record<string, string> = {
  accept: "accepted",
  reject: "rejected",
  stuck: "halted with no rule",
  cap: "step cap reached",
};

export function TMLab({ onContext }: Props) {
  const [presetId, setPresetId] = useState(TM_PRESETS[0]!.id);
  const preset: TMPreset = useMemo(
    () => TM_PRESETS.find((p) => p.id === presetId) ?? TM_PRESETS[0]!,
    [presetId],
  );
  const [input, setInput] = useState(preset.samples[0]?.str ?? "");
  const [ran, setRan] = useState<{ input: string; run: ReturnType<typeof runTM> } | null>(null);
  const [cursor, setCursor] = useState(0);

  const problems = useMemo(() => validateTM(preset.tm), [preset]);

  const pick = (id: string) => {
    const next = TM_PRESETS.find((p) => p.id === id);
    if (!next) return;
    setPresetId(id);
    setInput(next.samples[0]?.str ?? "");
    setRan(null);
    setCursor(0);
  };

  const execute = (str: string) => {
    const bad = [...str].find((c) => !preset.tm.inputAlphabet.includes(c));
    if (bad !== undefined) {
      toast.error(`"${bad}" is outside Σ = {${preset.tm.inputAlphabet.join(",")}}.`);
      return;
    }
    const run = runTM(preset.tm, str);
    setRan({ input: str, run });
    setCursor(0);
    if (run.halt === "cap") {
      toast(`Gave up after ${TM_STEP_CAP.toLocaleString()} steps — this machine may never halt.`);
      Storage.appendMistake("tm", preset.id, `"${str}" ran past the step cap on ${preset.name}.`);
    } else if (run.halt === "accept") {
      Storage.recordSolve("tm", preset.id, 1);
    }
  };

  useEffect(() => {
    const offs = [
      onTutorAction("tmChallenge", (a) => {
        const found = findTMPreset(a.preset);
        if (!found) {
          toast.error(`Socratic asked for a tape machine I don't have (${a.preset}).`);
          return;
        }
        setPresetId(found.id);
        setInput(a.input);
        setRan(null);
        setCursor(0);
        toast.success(`Tape machine loaded: ${found.name}`);
      }),
      onTutorAction("tapeWrite", (a) => {
        setInput(a.value);
        if (a.run) execute(a.value);
        else {
          setRan(null);
          setCursor(0);
        }
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [preset]);

  const steps = ran?.run.steps ?? [];
  const step = steps[Math.min(cursor, Math.max(steps.length - 1, 0))];

  useEffect(() => {
    onContext?.(() =>
      [
        `Module: TM Lab — machine "${preset.name}" (${preset.formal}).`,
        `Γ = {${preset.tm.tapeAlphabet.join(",")}} with blank "${BLANK}"; accept=${preset.tm.acceptState}, reject=${preset.tm.rejectState}.`,
        `Rules: ${preset.tm.rules.map((r) => `${r.from}:${tmRuleLabel(r)}→${r.to}`).join("; ")}`,
        ran
          ? `Last run on "${ran.input || "ε"}": ${HALT_TEXT[ran.run.halt]} after ${ran.run.totalSteps} steps; final tape "${ran.run.output}". Student is viewing configuration ${cursor + 1}/${steps.length}.`
          : "Nothing has been run yet.",
      ].join("\n"),
    );
  }, [preset, ran, cursor, steps.length, onContext]);

  return (
    <div className="module-grid">
      <aside className="module-panel-left">
        <div className="flex flex-col gap-1">
          <span className="section-label">Tape machine</span>
          {TM_PRESETS.map((p) => (
            <button
              key={p.id}
              className="tape-row"
              data-verdict={p.id === presetId ? "accept" : undefined}
              onClick={() => pick(p.id)}
            >
              <span>{p.name}</span>
            </button>
          ))}
        </div>

        <div className="lab-card">
          <span className="section-label">Why a tape</span>
          <p className="mt-1 text-[11px]" style={{ color: "var(--ink-muted)" }}>
            {preset.intuition}
          </p>
        </div>

        <div className="lab-card">
          <span className="section-label">Try these</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {preset.samples.map((s) => (
              <button
                key={s.str}
                className="btn-ghost"
                onClick={() => {
                  setInput(s.str);
                  execute(s.str);
                }}
              >
                {s.str || "ε"}
              </button>
            ))}
          </div>
        </div>

        <div className="lab-card">
          <span className="section-label">Transition table</span>
          <div className="mt-1 flex flex-col gap-1 text-[11px]">
            {preset.tm.rules.map((r, n) => (
              <span
                key={n}
                style={{
                  fontFamily: "var(--font-mono-family)",
                  color: step?.via === r ? "var(--ink)" : "var(--ink-muted)",
                }}
              >
                δ({r.from}, {r.read}) = ({r.to}, {r.write}, {r.move})
              </span>
            ))}
          </div>
        </div>

        {problems.length > 0 && (
          <div className="lab-card">
            <span className="section-label">Warnings</span>
            {problems.map((p, n) => (
              <p key={n} className="mt-1 text-[11px]">
                {p}
              </p>
            ))}
          </div>
        )}
      </aside>

      <section className="workbench">
        <div className="canvas-toolbar">
          <span className="badge" data-tone="amber">
            <Tally5 size={12} className="mr-1 inline" />
            TM
          </span>
          <input
            className="field-input"
            style={{ width: 220 }}
            value={input}
            placeholder={`string over ${preset.tm.inputAlphabet.join("")}`}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && execute(input)}
          />
          <button className="btn-primary" onClick={() => execute(input)}>
            <Play size={13} className="mr-1 inline" />
            Run
          </button>
          {ran && (
            <>
              <button
                className="btn-ghost"
                disabled={cursor === 0}
                onClick={() => setCursor((c) => Math.max(0, c - 1))}
              >
                <SkipBack size={13} />
              </button>
              <button
                className="btn-ghost"
                disabled={cursor >= steps.length - 1}
                onClick={() => setCursor((c) => Math.min(steps.length - 1, c + 1))}
              >
                <SkipForward size={13} />
              </button>
              <span
                className="badge"
                data-tone={
                  ran.run.halt === "accept" ? "cyan" : ran.run.halt === "cap" ? "amber" : "rose"
                }
              >
                {HALT_TEXT[ran.run.halt]}
              </span>
              <span className="badge">{ran.run.totalSteps} steps</span>
            </>
          )}
          <button className="btn-ghost ml-auto" onClick={() => pick(presetId)}>
            <RotateCcw size={13} className="mr-1 inline" />
            Reset
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {!ran && (
              <div className="lab-card">
                <span className="section-label">{preset.name}</span>
                <p className="mt-1 text-xs" style={{ fontFamily: "var(--font-mono-family)" }}>
                  {preset.formal}
                </p>
                <p className="mt-2 text-[11px]" style={{ color: "var(--ink-muted)" }}>
                  Every run is capped at {TM_STEP_CAP.toLocaleString()} steps, so a machine that
                  never halts fails loudly instead of freezing the page.
                </p>
              </div>
            )}

            {ran && step && (
              <>
                <div className="lab-card">
                  <span className="section-label">
                    Tape — configuration {cursor + 1} / {steps.length}
                    {steps.length < ran.run.totalSteps + 1 ? " (first 400 shown)" : ""}
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {step.cells.map((c) => (
                      <span
                        key={c.index}
                        className="badge"
                        data-tone={c.index === step.head ? "amber" : undefined}
                        style={{
                          fontFamily: "var(--font-mono-family)",
                          minWidth: 26,
                          justifyContent: "center",
                        }}
                      >
                        {c.symbol}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px]" style={{ color: "var(--ink-muted)" }}>
                    State <strong>{step.state}</strong>, head at cell {step.head}.{" "}
                    {step.via
                      ? `Applied δ(${step.via.from}, ${step.via.read}) = (${step.via.to}, ${step.via.write}, ${step.via.move}).`
                      : "Initial configuration."}
                  </p>
                </div>

                <div className="lab-card">
                  <span className="section-label">Result</span>
                  <p className="mt-1 text-xs">
                    {ran.run.halt === "accept" && "The machine reached its accept state."}
                    {ran.run.halt === "reject" && "The machine reached its reject state."}
                    {ran.run.halt === "stuck" &&
                      "No rule matched the current (state, symbol) pair — the machine halted by omission, which also counts as rejecting."}
                    {ran.run.halt === "cap" &&
                      `Still running after ${ran.run.totalSteps.toLocaleString()} steps. There is no general way to know whether it ever stops — that is the halting problem, live.`}
                  </p>
                  {ran.run.output && (
                    <p className="mt-1 text-[11px]" style={{ fontFamily: "var(--font-mono-family)" }}>
                      Final tape: {ran.run.output}
                    </p>
                  )}
                </div>

                <div className="lab-card">
                  <span className="section-label">Configuration history</span>
                  <div className="mt-1 flex flex-col gap-1 text-[11px]">
                    {steps.slice(0, 80).map((s, i) => (
                      <button
                        key={i}
                        className="text-left"
                        style={{
                          fontFamily: "var(--font-mono-family)",
                          color: i === cursor ? "var(--ink)" : "var(--ink-muted)",
                        }}
                        onClick={() => setCursor(i)}
                      >
                        {i + 1}. {s.state} @ {s.head}{" "}
                        {s.via ? `— ${tmRuleLabel(s.via)}` : "— start"}
                      </button>
                    ))}
                    {steps.length > 80 && (
                      <span style={{ color: "var(--ink-disabled)" }}>
                        …and {steps.length - 80} more configurations.
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
