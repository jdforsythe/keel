// Tables beside the k.expect conformance: honest `expect` forms check accepts (Decides), disguised total ones it
// refuses, and error data it refuses however the value travelled (Carries). Type pass on.
import { check } from "@keel/check";
import { testTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";

const MANIFEST = {
  path: "modules/m/module.ts",
  source:
    "import { module } from '@keel/compiler'\nexport default module({ id: 'm', deps: [], capabilities: [], public: { exports: [] } })\n",
};
const HEAD = [
  "import { attempt, s } from '@keel/schema'",
  "const E = s.error('m.t', s.object({}))",
  "const T = E.make({})",
  "const W = s.error('m.w', s.object({ why: s.string() }))",
  "const N = s.error('m.n', s.object({ status: s.int(), kind: s.enum(['a', 'b']) }))",
  "const K = s.error('m.k', s.object({ code: s.enum(['23505', '23503']) }))",
  "const L = s.error('m.l', s.object({ codes: s.array(s.enum(['a', 'b'])), at: s.object({ n: s.int() }) }))",
  "const Txt = s.string()",
  "const Code = s.enum(['23505', '23503'])",
  "class HttpError extends Error { status = 0 }",
  "declare const f: () => number",
  "declare const isUnique: (x: unknown) => boolean",
  "declare const kindOf: (x: HttpError) => 'a' | 'b'",
  "const why = (e: Error) => e.message",
  "",
].join("\n");
const NEVER = "expect claims every throw: it never returns undefined";
const UNTESTED = "expect claims every throw: return the error where instanceof, ===, a guard or .ok holds";
const COPIES = "expect copies thrown text: carry a number, a boolean or a closed code";
const OPEN = "error data an expect returns is open text: carry a number, a boolean or a closed code";

/** Each form's `E1452` and `E1460` messages, one exported `attempt` per line. */
const findings = (forms: readonly string[]): string[][] => {
  const source = `${HEAD}${forms.map((x, i) => `export const r${i} = attempt(f, ${x})`).join("\n")}\n`;
  const base = HEAD.split("\n").length - 1;
  const ds = check([MANIFEST, { path: "modules/m/a.ts", source }], { types: true }).diagnostics.filter(
    (d) => d.path === "modules/m/a.ts" && (d.code === "E1452" || d.code === "E1460"),
  );
  return forms.map((_, i) => ds.filter((d) => d.line === base + i + 1).map((d) => `${d.code} ${d.message}`));
};

const HONEST = [
  "(x) => (x instanceof RangeError ? T : undefined)",
  "(x) => { if (!(x instanceof HttpError)) return undefined; return T }",
  "(x) => { if (!(x instanceof HttpError)) return; switch (x.status) { case 503: return T; default: return undefined } }",
  "(x) => { switch (Reflect.get(Object(x), 'code')) { case '23505': return T; default: return undefined } }",
  "(x) => { const r = Code.parse(Reflect.get(Object(x), 'code')); if (!r.ok) return undefined; return T }",
  "(x) => { const r = Code.parse(x); return r.ok ? T : undefined }",
  "(x) => (Reflect.get(Object(x), 'code') === '23505' ? T : undefined)",
  "(x) => (typeof x === 'object' && x !== null && Reflect.get(x, 'code') === '23505' ? T : undefined)",
  "(x) => (isUnique(x) ? T : undefined)",
  "(x) => { if (x instanceof TypeError) return T; return undefined }",
  "(x) => { if (x instanceof TypeError) { return T } else { return undefined } }",
  "(x) => (x instanceof HttpError && x.status === 503 ? T : undefined)",
  "(x) => (x instanceof RangeError || x instanceof TypeError ? T : undefined)",
  "(x) => { const c = Reflect.get(Object(x), 'code'); if (c !== '23505') return undefined; return T }",
  "function (x: unknown) { if (!(x instanceof HttpError)) return undefined; if (x.status !== 503) return undefined; return T }",
  "(x) => (x instanceof HttpError ? (x.status === 503 ? T : undefined) : undefined)",
  "(x) => { if (!(x instanceof HttpError)) return undefined; return x.status === 503 ? T : undefined }",
  "(x) => (Code.parse(Reflect.get(Object(x), 'code')).ok ? T : undefined)",
  "(x) => { switch (typeof x) { case 'string': return T; default: return undefined } }",
];
const TOTAL: readonly (readonly [string, string, ...string[]])[] = [
  ["(x) => (void x, T)", NEVER],
  ["(x) => E.make({}, typeof x)", NEVER, "E1460 error message is not a literal: pass values as data"],
  ["(_x) => T", NEVER],
  ["(x) => (x === x ? T : undefined)", UNTESTED],
  ["(x) => (x ? T : undefined)", UNTESTED],
  ["(x) => { if (x) return undefined; return T }", UNTESTED],
  ["(x) => { if (x === x) return undefined; return T }", UNTESTED],
  ["(x) => { switch (x) { default: return T; case 1: return undefined } }", UNTESTED],
  ["(x) => { switch (x) { case x: return T; default: return undefined } }", UNTESTED],
  ["(x) => { const r = Code.parse('23505'); if (!r.ok) return undefined; return T }", UNTESTED],
  ["(x) => { let t = x instanceof Error; t = true; return t ? T : undefined }", UNTESTED],
  ["(x) => { if (!(x instanceof Error)) { void 0 } else return undefined; return T }", UNTESTED],
];
const LEAKS: readonly (readonly [string, string])[] = [
  [
    "(x) => { if (!(x instanceof Error)) return undefined; const { message } = x; return W.make({ why: message }) }",
    OPEN,
  ],
  [
    "(x) => { if (!(x instanceof Error)) return undefined; let m = ''; m = x.message; return W.make({ why: m }) }",
    OPEN,
  ],
  ["(x) => { if (!(x instanceof Error)) return undefined; const [m] = [x.message]; return W.make({ why: m }) }", OPEN],
  [
    "(x) => { const m = x instanceof Error ? x.message : ''; return x instanceof Error ? W.make({ why: m }) : undefined }",
    OPEN,
  ],
  ["(x) => { if (!(x instanceof Error)) return undefined; const d = { why: x.message }; return W.make(d) }", OPEN],
  [
    "(x) => { const t = Txt.parse(Reflect.get(Object(x), 'detail')); if (t.ok) return W.make({ why: t.value }); return undefined }",
    OPEN,
  ],
  ["(x) => (x instanceof Error ? W.make({ ...{ why: 'a' } }) : undefined)", OPEN],
  ["(x) => (x instanceof Error ? W.make({ why: why(x) }) : undefined)", COPIES],
  ["(x) => { if (!(x instanceof Error)) return undefined; const e = W.make({ why: 'fixed' }); return e }", OPEN],
];
const CLEAN = [
  "(x) => (x instanceof HttpError ? N.make({ status: x.status, kind: kindOf(x) }) : undefined)",
  "(x) => { const r = Code.parse(Reflect.get(Object(x), 'code')); if (!r.ok) return undefined; return K.make({ code: r.value }) }",
  "(x) => (x instanceof Error ? W.make({ why: 'dup' }) : undefined)",
  "(x) => (x instanceof Error ? N.make({ status: 503, kind: x.name === 'A' ? 'a' : 'b' }) : undefined)",
  "(x) => (x instanceof Error ? L.make({ codes: ['a'], at: { n: x.name === 'A' ? 1 : 2 } }) : undefined)",
];

describe("k.expect forms", { timeout: testTime(120_000) }, () => {
  it("accepts each honest form, and refuses each disguised total form with the message that names what is missing", () => {
    const got = findings([...HONEST, ...TOTAL.map(([f]) => f)]);
    HONEST.forEach((form, i) => expect([form, got[i]]).toEqual([form, []]));
    TOTAL.forEach(([form, message, ...more], i) =>
      expect([form, got[HONEST.length + i]?.sort()]).toEqual([form, [`E1452 ${message}`, ...more].sort()]),
    );
  });

  it("refuses open text in an expect's error data however it travelled, and passes closed data", () => {
    const got = findings([...LEAKS.map(([f]) => f), ...CLEAN]);
    LEAKS.forEach(([form, message], i) => expect([form, got[i]]).toEqual([form, [`E1460 ${message}`]]));
    CLEAN.forEach((form, i) => expect([form, got[LEAKS.length + i]]).toEqual([form, []]));
  });
});
