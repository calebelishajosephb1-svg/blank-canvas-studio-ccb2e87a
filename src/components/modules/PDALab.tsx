import { useEffect, useMemo, useState } from "react";
import {
  PDA_PRESETS,
  findPDAPreset,
  ruleLabel,
  runPDA,
  stackLabel,
  validatePDA,
  type PDAPreset,
} from "@/lib/engine/pda";
import { Storage } from "@/lib/storage";
import { onTutorAction } from "@/lib/tutor/actions";
import { toast } from "sonner";
import { Layers3, Play, SkipBack, SkipForward, RotateCcw } from "lucide-react";

interface Props {
  active?: boolean;
  onContext?: (fn: () => string) => void;
}

export function PDALab({ onContext }: Props) {
  const [presetId, setPresetId] = useState(PDA_PRESETS[0]!.id);
  const preset: PDAPreset = useMemo(
    () => PDA_PRESETS.find((p) => p.id === presetId) ?? PDA_PRESETS[0]!,
    [presetId],
  );
  const [input, setInput] = useState(preset.samples[0]?.str ?? "");
  const [ran, setRan] = useState<{ input: string; run: ReturnType<typeof runPDA> } | null>(null);
  const [cursor, setCursor] = useState(0);

  const problems = useMemo(() => validatePDA(preset.pda), [preset]);

  const pick = (id: string) => {
    const next = PDA_PRESETS.find((p) => p.id === id);
    if (!next) return;
    setPresetId(id);
    setInput(next.samples[0]?.str ?? "");
    setRan(null);
    setCursor(0);
  };

  const execute = (str: string) => {
    const bad = [...str].find((c) => !preset.pda.inputAlphabet.includes(c));
    if (bad !== undefined) {
      toast.error(`"${bad}" is outside Σ = {${preset.pda.inputAlphabet.join(",")}}.`);
      return;
    }
    const run = runPDA(preset.pda, str);
    setRan({ input: str, run });
    setCursor(0);
    const expected = preset.samples.find((s) => s.str === str);
    if (expected && expected.inLanguage !== run.accepted) {
      Storage.appendMistake("pda", preset.id, `PDA disagreed with the sample verdict on "${str}".`);
    } else if (run.accepted) {
      Storage.recordSolve("pda", preset.id, 1);
    }
  };

  /* ── tutor control ─────────────────────────────────────────────────── */
  useEffect(() => {
    const offs = [
      onTutorAction("pdaChallenge", (a) => {
        const found = findPDAPreset(a.preset);
        if (!found) {
          toast.error(`Socratic asked for a stack machine I don't have (${a.preset}).`);
          return;
        }
        setPresetId(found.id);
        setInput(a.input);
        setRan(null);
        setCursor(0);
        toast.success(`Stack machine loaded: ${found.name}`);
      }),
      onTutorAction("stackStep", (a) => {
        setInput(a.value);
        execute(a.value);
      }),
    ];
    return () => offs.forEach((off) => off());
    // execute closes over the current preset, which is exactly what we want.
  }, [preset]);

  const path = ran?.run.path ?? [];
  const config = path[Math.min(cursor, Math.max(path.length - 1, 0))];

  useEffect(() => {
    onContext?.(() =>
      [
        `Module: PDA Lab — machine "${preset.name}" (${preset.formal}).`,
        `Acceptance by ${preset.pda.acceptance === "empty" ? "empty stack" : "final state"}; Σ = {${preset.pda.inputAlphabet.join(",")}}, Γ = {${preset.pda.stackAlphabet.join(",")}}.`,
        `Rules: ${preset.pda.rules.map((r) => `${r.from} ${ruleLabel(r)} ${r.to}`).join("; ")}`,
        ran
          ? `Last run on "${ran.input || "ε"}": ${ran.run.accepted ? "ACCEPTED" : ran.run.capped ? "gave up at the step cap" : "rejected"} after exploring ${ran.run.explored} configurations. Student is at step ${cursor + 1}/${path.length}; stack = ${config ? stackLabel(config.stack) : "n/a"}.`
          : "Nothing has been run yet.",
      ].join("\n"),
    );
  }, [preset, ran, cursor, path.length, config, onContext]);

  return (
    <div className="module-grid">
      <aside className="module-panel-left">
        <div className="flex flex-col gap-1">
          <span className="section-label">Stack machine</span>
          {PDA_PRESETS.map((p) => (
            <button
              key={p.id}
              className="tape-row"
              data-verdict={p.id === presetId ? "accept" : undefined}
              onClick={() => pick(p.id)}
            >
              <span>{p.name}</span>
              <span style={{ color: "var(--ink-disabled)" }}>
                {p.pda.acceptance === "empty" ? "empty stack" : "final state"}
              </span>
            </button>
          ))}
        </div>

        <div className="lab-card">
          <span className="section-label">What the stack buys you</span>
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
          <span className="section-label">Transition rules</span>
          <div className="mt-1 flex flex-col gap-1 text-[11px]">
            {preset.pda.rules.map((r, n) => (
              <span
                key={n}
                style={{
                  fontFamily: "var(--font-mono-family)",
                  color:
                    config?.via === r ? "var(--accent-cyan, var(--ink))" : "var(--ink-muted)",
                }}
              >
                δ({r.from}, {r.read || "ε"}, {r.pop || "ε"}) = ({r.to}, {r.push || "ε"})
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
          <span className="badge" data-tone="cyan">
            <Layers3 size={12} className="mr-1 inline" />
            PDA
          </span>
          <input
            className="field-input"
            style={{ width: 220 }}
            value={input}
            placeholder={`string over ${preset.pda.inputAlphabet.join("")}`}
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
                disabled={cursor >= path.length - 1}
                onClick={() => setCursor((c) => Math.min(path.length - 1, c + 1))}
              >
                <SkipForward size={13} />
              </button>
              <span className="badge" data-tone={ran.run.accepted ? "cyan" : "rose"}>
                {ran.run.accepted ? "accepted" : ran.run.capped ? "step cap" : "rejected"}
              </span>
              <span className="badge">
                step {Math.min(cursor + 1, path.length)} / {path.length}
              </span>
            </>
          )}
          <button className="btn-ghost ml-auto" onClick={() => pick(presetId)}>
            <RotateCcw size={13} className="mr-1 inline" />
            Reset
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            {!ran && (
              <div className="lab-card">
                <span className="section-label">{preset.name}</span>
                <p className="mt-1 text-xs" style={{ fontFamily: "var(--font-mono-family)" }}>
                  {preset.formal}
                </p>
                <p className="mt-2 text-[11px]" style={{ color: "var(--ink-muted)" }}>
                  Type a string and press Run — then step through and watch the stack, not the
                  states. The stack is the only thing a finite automaton cannot have.
                </p>
              </div>
            )}

            {ran && config && (
              <>
                <div className="lab-card">
                  <span className="section-label">Input tape</span>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {([...ran.input].length ? [...ran.input] : ["ε"]).map((ch, i) => (
                      <span
                        key={i}
                        className="badge"
                        data-tone={
                          i < config.pos ? "cyan" : i === config.pos ? "amber" : undefined
                        }
                        style={{ fontFamily: "var(--font-mono-family)" }}
                      >
                        {ch}
                      </span>
                    ))}
                    <span className="badge" data-tone={config.pos >= ran.input.length ? "amber" : undefined}>
                      ⊣
                    </span>
                  </div>
                </div>

                <div className="lab-card">
                  <span className="section-label">Stack (top first)</span>
                  <div className="mt-2 flex flex-col-reverse items-start gap-1">
                    {config.stack.length === 0 && (
                      <span className="text-[11px]" style={{ color: "var(--ink-disabled)" }}>
                        empty
                      </span>
                    )}
                    {[...config.stack].reverse().map((sym, i) => (
                      <span
                        key={i}
                        className="badge"
                        data-tone={i === config.stack.length - 1 ? "cyan" : undefined}
                        style={{ fontFamily: "var(--font-mono-family)", minWidth: 40 }}
                      >
                        {sym}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="lab-card">
                  <span className="section-label">Configuration</span>
                  <p className="mt-1 text-xs" style={{ fontFamily: "var(--font-mono-family)" }}>
                    ({config.state}, {ran.input.slice(config.pos) || "ε"},{" "}
                    {stackLabel(config.stack)})
                  </p>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--ink-muted)" }}>
                    {config.via
                      ? `Applied δ(${config.via.from}, ${config.via.read || "ε"}, ${config.via.pop || "ε"}) = (${config.via.to}, ${config.via.push || "ε"}).`
                      : "Initial configuration."}
                  </p>
                </div>

                <div className="lab-card">
                  <span className="section-label">Derivation</span>
                  <div className="mt-1 flex flex-col gap-1 text-[11px]">
                    {path.map((c, i) => (
                      <button
                        key={i}
                        className="text-left"
                        style={{
                          fontFamily: "var(--font-mono-family)",
                          color: i === cursor ? "var(--ink)" : "var(--ink-muted)",
                          opacity: i === cursor ? 1 : 0.75,
                        }}
                        onClick={() => setCursor(i)}
                      >
                        {i + 1}. ({c.state}, {ran.input.slice(c.pos) || "ε"}, {stackLabel(c.stack)})
                      </button>
                    ))}
                  </div>
                  {!ran.run.accepted && (
                    <p className="mt-2 text-[11px]" style={{ color: "var(--ink-muted)" }}>
                      {ran.run.capped
                        ? `The search hit its ${ran.run.explored}-configuration cap — this machine wanders.`
                        : `No accepting path exists: all ${ran.run.explored} reachable configurations were checked. Shown above is the furthest the machine got.`}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
