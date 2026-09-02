import { describe, it, expect } from "vitest";
import { regexToNFA, regexToDFA } from "@/lib/engine/regex";
import { nfaToRegex, toDfa, verifyRegexAgainstDfa, removeEpsilons, liftToNfa } from "@/lib/engine/convert";
import { findCounterexample } from "@/lib/engine/algorithms";
import { buildPumpingLanguage, adversarySplit, checkCandidate } from "@/lib/engine/pumping";

const cases: [string, string[]][] = [
  ["(0|1)*1", ["0","1"]], ["a|ε", ["a"]], ["ε", ["a","b"]], ["a*", ["a"]],
  ["(ab|b)*a", ["a","b"]], ["0(0|1)*|ε", ["0","1"]], ["(a|b|c)*cc", ["a","b","c"]],
];
describe("regex round trip", () => {
  for (const [r, al] of cases)
    it(r, () => {
      const nfa = regexToNFA(r, al);
      const { regex } = nfaToRegex(nfa);
      expect(regex, "no regex").toBeTruthy();
      const v = verifyRegexAgainstDfa(regex!, toDfa(nfa));
      expect(v.equivalent, `${r} -> ${regex} ce=${v.counterexample?.string}`).toBe(true);
    });
});
describe("eps removal preserves language", () => {
  for (const [r, al] of cases)
    it(r, () => {
      const nfa = regexToNFA(r, al);
      const { nfa: out } = removeEpsilons(nfa);
      expect(findCounterexample(toDfa(nfa), toDfa(out))).toBeNull();
      expect(findCounterexample(toDfa(nfa), liftToNfa(nfa.toDFA().dfa) && toDfa(liftToNfa(nfa.toDFA().dfa)))).toBeNull();
    });
});
describe("pumping builder", () => {
  it("equal", () => {
    const L = buildPumpingLanguage("equal", ["a","b"])!;
    expect(L.member("aabb")).toBe(true);
    expect(L.member("abab")).toBe(false);
    expect(L.member("aab")).toBe(false);
    expect(checkCandidate(L, L.suggest(3)[0]!, 3).ok).toBe(true);
    expect(adversarySplit(L, "aaabbb", 3)).toBeTruthy();
  });
  it("triple/prime/bad", () => {
    expect(buildPumpingLanguage("triple", ["x","y","z"])!.member("xxyyzz")).toBe(true);
    expect(buildPumpingLanguage("prime", ["1"])!.member("1111111")).toBe(true);
    expect(buildPumpingLanguage("prime", ["1"])!.member("1111")).toBe(false);
    expect(buildPumpingLanguage("equal", ["a"])).toBeNull();
    expect(buildPumpingLanguage("nope", ["a","b"])).toBeNull();
  });
  it("ww/palindrome", () => {
    const w = buildPumpingLanguage("ww", ["0","1"])!;
    expect(w.member("0101")).toBe(true); expect(w.member("0110")).toBe(false);
    const pl = buildPumpingLanguage("palindrome", ["a","b"])!;
    expect(pl.member("aba")).toBe(true); expect(pl.member("ab")).toBe(false);
  });
});
