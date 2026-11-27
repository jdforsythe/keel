// Spec: k.reactive, clause "A fetcher resolving a keel Result `err(e)` settles `error` with `e`, one resolving `ok(v)` settles `ready` with `v`, one resolving a plain object shaped like a Result settles `ready` with that object, and one that throws or rejects settles `error` with the thrown value."
// Spec: k.reactive, clause "A fetcher typed `Promise<Result<T, E>>` gives `Resource<T>`, and one typed `Promise<{ ok: boolean; value?: T }>` compiles and gives a `Resource` of that type."
// Seed 1337 for the property tests (fast-check). Clause B has no random inputs: the TypeScript compiler is the oracle,
// as in packages/store/conformance/payload-type-compile-error.test.ts (in-memory probe, package tsconfig, no suppressions).
import { fixedTime } from "@keel/tooling/test-time";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resource, scope } from "@keel/reactive";
import { err, ok } from "@keel/schema";
import fc from "fast-check";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";

const CLAUSE_A =
  "A fetcher resolving a keel Result `err(e)` settles `error` with `e`, one resolving `ok(v)` settles `ready` with `v`, one resolving a plain object shaped like a Result settles `ready` with that object, and one that throws or rejects settles `error` with the thrown value.";
const CLAUSE_B =
  "A fetcher typed `Promise<Result<T, E>>` gives `Resource<T>`, and one typed `Promise<{ ok: boolean; value?: T }>` compiles and gives a `Resource` of that type.";

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const RUNS = { seed: 1337, numRuns: 50 };

interface Settled {
  readonly state: string;
  readonly value?: unknown;
  readonly error?: unknown;
}

/** Runs a resource over `fetcher` in a scope, flushes microtasks, returns the settled state. */
async function settle(fetcher: () => Promise<unknown>): Promise<Settled> {
  let get: () => Settled = () => ({ state: "unset" });
  scope(
    () => {
      const r = resource(fetcher);
      get = () => r.get();
    },
    { detached: true },
  );
  await flush();
  return get();
}

describe(`k.reactive: ${CLAUSE_A}`, () => {
  it(`${CLAUSE_A} err(e) settles error with e`, async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async (e) => {
        const s = await settle(() => Promise.resolve(err(e)));
        expect(s.state).toBe("error");
        expect(Object.is(s.error, e)).toBe(true);
      }),
      RUNS,
    );
  });

  it(`${CLAUSE_A} ok(v) settles ready with v`, async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async (v) => {
        const s = await settle(() => Promise.resolve(ok(v)));
        expect(s.state).toBe("ready");
        expect(Object.is(s.value, v)).toBe(true);
      }),
      RUNS,
    );
  });

  it(`${CLAUSE_A} a plain { ok: false, error } object settles ready with that object`, async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async (x) => {
        const plain = { ok: false, error: x };
        const s = await settle(() => Promise.resolve(plain));
        expect(s.state).toBe("ready");
        expect(s.value).toBe(plain);
      }),
      RUNS,
    );
  });

  it(`${CLAUSE_A} a plain { ok: true, value } object settles ready with that object`, async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async (x) => {
        const plain = { ok: true, value: x };
        const s = await settle(() => Promise.resolve(plain));
        expect(s.state).toBe("ready");
        expect(s.value).toBe(plain);
      }),
      RUNS,
    );
  });

  it(`${CLAUSE_A} a synchronous throw settles error with the thrown value`, async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async (x) => {
        const s = await settle((): Promise<unknown> => {
          throw x;
        });
        expect(s.state).toBe("error");
        expect(Object.is(s.error, x)).toBe(true);
      }),
      RUNS,
    );
  });

  it(`${CLAUSE_A} an async throw settles error with the thrown value`, async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async (x) => {
        const s = await settle(async (): Promise<unknown> => {
          await Promise.resolve();
          throw x;
        });
        expect(s.state).toBe("error");
        expect(Object.is(s.error, x)).toBe(true);
      }),
      RUNS,
    );
  });

  it(`${CLAUSE_A} a rejection settles error with the rejection value`, async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async (x) => {
        const s = await settle(() => Promise.reject(x));
        expect(s.state).toBe("error");
        expect(Object.is(s.error, x)).toBe(true);
      }),
      RUNS,
    );
  });

  it(`${CLAUSE_A} a plain non-object value settles ready with that value`, async () => {
    await fc.assert(
      fc.asyncProperty(fc.oneof(fc.integer(), fc.string(), fc.boolean(), fc.constant(null)), async (x) => {
        const s = await settle(() => Promise.resolve(x));
        expect(s.state).toBe("ready");
        expect(Object.is(s.value, x)).toBe(true);
      }),
      RUNS,
    );
  });
});

// ---- Clause B: the compiler is the oracle ----
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROBE = path.join(HERE, "__resource_result_probe__.ts");

const PRELUDE = `import { resource } from "@keel/reactive";
import type { Resource } from "@keel/reactive";
import { ok } from "@keel/schema";
import type { KeelError, Result } from "@keel/schema";
type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type E0 = KeelError<"x.y", null>;
type Shaped = { ok: boolean; value?: string };
const typedResult = (): Promise<Result<number, E0>> => Promise.resolve(ok(1));
const typedShaped = (): Promise<Shaped> => Promise.resolve({ ok: true, value: "a" });
const typedPlain = (): Promise<number> => Promise.resolve(1);
function branching(flag: boolean) { if (flag) return Promise.reject(new Error("no")); return Promise.resolve(1); }
export const probe = [resource, ok, typedResult, typedShaped, typedPlain, branching];
`;

interface Case {
  readonly name: string;
  readonly code: string;
}

const GOOD: readonly Case[] = [
  {
    name: "resource(() => Promise.resolve(ok(1))) is Resource<number>",
    code: "(() => { const r = resource(() => Promise.resolve(ok(1))); const c: Eq<typeof r, Resource<number>> = true; return c; })()",
  },
  {
    name: "a fetcher typed () => Promise<Result<number, KeelError>> is Resource<number>",
    code: "(() => { const r = resource(typedResult); const c: Eq<typeof r, Resource<number>> = true; return c; })()",
  },
  {
    name: "resource<Result<number, string>>(async () => ok(1)) is Resource<number>",
    code: "(() => { const r = resource<Result<number, string>>(async () => ok(1)); const c: Eq<typeof r, Resource<number>> = true; return c; })()",
  },
  {
    name: "a fetcher typed () => Promise<{ ok: boolean; value?: string }> is Resource<{ ok: boolean; value?: string }>",
    code: "(() => { const r = resource(typedShaped); const c: Eq<typeof r, Resource<Shaped>> = true; return c; })()",
  },
  {
    name: "a plain () => Promise<number> is Resource<number>",
    code: "(() => { const r = resource(typedPlain); const c: Eq<typeof r, Resource<number>> = true; return c; })()",
  },
  {
    name: "a fetcher with a Promise.reject branch next to Promise.resolve(1) is Resource<number>",
    code: "(() => { const r = resource(() => branching(true)); const c: Eq<typeof r, Resource<number>> = true; return c; })()",
  },
];

const BAD: readonly Case[] = [
  {
    name: "reading .ok on the ready value of Resource<number> is a compile error",
    code: `(() => { const s = resource(() => Promise.resolve(ok(1))).get(); return s.state === "ready" ? s.value.ok : 0; })()`,
  },
  {
    name: "Resource<number> is not Resource<Result<number, E0>>",
    code: "(() => { const r = resource(typedResult); const c: Eq<typeof r, Resource<Result<number, E0>>> = true; return c; })()",
  },
];

function probeSource(cases: readonly Case[]): { source: string; lines: number[] } {
  const base = PRELUDE.split("\n").length - 1;
  const body = cases.map((c, i) => `export const case${i} = ${c.code};`);
  return { source: `${PRELUDE}${body.join("\n")}\n`, lines: cases.map((_, i) => base + i) };
}

function typeErrors(source: string): { line: number; code: number; text: string }[] {
  const configPath = path.join(HERE, "../tsconfig.json");
  const read = ts.readConfigFile(configPath, (p) => ts.sys.readFile(p));
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configPath));
  const options: ts.CompilerOptions = { ...parsed.options, noEmit: true };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, shouldCreate) =>
    path.resolve(name) === PROBE
      ? ts.createSourceFile(name, source, languageVersion, true)
      : getSourceFile(name, languageVersion, onError, shouldCreate);
  host.fileExists = (name) => path.resolve(name) === PROBE || fileExists(name);
  host.readFile = (name) => (path.resolve(name) === PROBE ? source : readFile(name));
  const program = ts.createProgram([PROBE], options, host);
  const file = program.getSourceFile(PROBE);
  if (file === undefined) throw new Error("probe source file was not created");
  return ts
    .getPreEmitDiagnostics(program, file)
    .filter((d) => d.category === ts.DiagnosticCategory.Error)
    .map((d) => ({
      line: d.file === undefined || d.start === undefined ? -1 : d.file.getLineAndCharacterOfPosition(d.start).line,
      code: d.code,
      text: ts.flattenDiagnosticMessageText(d.messageText, " "),
    }));
}

describe(`k.reactive: ${CLAUSE_B}`, () => {
  const all = [...GOOD, ...BAD];
  const { source, lines } = probeSource(all);
  let errors: { line: number; code: number; text: string }[] = [];

  beforeAll(() => {
    errors = typeErrors(source);
  }, fixedTime(120_000));

  it("the probe's imports resolve and its prelude type-checks (every error is on a case line)", () => {
    expect(errors.filter((e) => e.code === 2307)).toEqual([]);
    expect(errors.filter((e) => !lines.includes(e.line))).toEqual([]);
  });

  GOOD.forEach((c, i) => {
    it(`${CLAUSE_B} Compiles with the exact type: ${c.name}`, () => {
      expect(errors.filter((e) => e.line === lines[i])).toEqual([]);
    });
  });

  BAD.forEach((c, j) => {
    it(`${CLAUSE_B} Compile error: ${c.name}`, () => {
      expect(errors.filter((e) => e.line === lines[GOOD.length + j]).length, c.code).toBeGreaterThan(0);
    });
  });
});
