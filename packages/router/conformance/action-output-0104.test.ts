// @vitest-environment happy-dom
// k.api, Output "An API entry's handler returns `Result<T, KeelError>` for its `output`'s type `T`; a page's action declares no `output` (k.contract Handlers)."
// Spec: k.api, clause "An API action returning a value its entry's `output` refuses does not compile."
// k.api, Output "`output` holds no `s.secret` (E1113, k.privacy): a secret leaves a `loader` or `action` `output` as `reveal(secret)` in an `s.string()` field."
// k.privacy, Rules "E1113 an `s.secret` in an `output`, thrown by `contract` or `loader` (k.routes; fix: none)."
// Spec: k.privacy, clause "An API entry or page loader whose `output` has an `s.secret` field throws E1113; with `s.string()`, none."
// k.guards, Guards "`caller` and `user` are k.server's and k.user's (`''` if none or client-only); `bearer` is k.api's (`undefined` off an API route; a redirect hop's guards get none)."
// Seed: 1337.
// The `endpoints` case of the RFC list (`@keel/services` takes no E1113) lives in packages/services/conformance/bearer-0104.test.ts: this package does not depend on `@keel/services`.
// Compile failures are asserted by type-checking in-memory modules (never written to disk) with packages/router/tsconfig.json: a control module
// that binds and reads everything correctly has no error, and each bad module, one line away from the control, has at least one.
// ASSUMPTION: E1113 over an entry's `output` is thrown by `contract()` or by the handler's declaration; `declare` below builds both, so either throws.
import { fixedTime } from "@keel/tooling/test-time";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { action, loader } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SEED = 1337; // seed 1337
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROBE = path.join(HERE, "__output_probe__.ts");

/** Error diagnostics (import-resolution errors aside) of one in-memory module. */
const typeErrors = (source: string): readonly string[] => {
  const configPath = path.join(HERE, "../tsconfig.json");
  const read = ts.readConfigFile(configPath, (f) => ts.sys.readFile(f));
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configPath));
  const options: ts.CompilerOptions = { ...parsed.options, noEmit: true };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  const isProbe = (name: string): boolean => path.resolve(name) === PROBE;
  host.getSourceFile = (name, languageVersion, onError, shouldCreate) =>
    isProbe(name)
      ? ts.createSourceFile(name, source, languageVersion, true)
      : getSourceFile(name, languageVersion, onError, shouldCreate);
  host.fileExists = (name) => isProbe(name) || fileExists(name);
  host.readFile = (name) => (isProbe(name) ? source : readFile(name));
  const program = ts.createProgram([PROBE], options, host);
  const sf = program.getSourceFile(PROBE);
  if (sf === undefined) throw new Error("probe source file was not created");
  return ts
    .getPreEmitDiagnostics(program, sf)
    .filter((d) => d.category === ts.DiagnosticCategory.Error && d.code !== 2307)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, " "));
};

const PROBE_HEAD = `import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
const Nothing = s.object({});
const N = s.object({ n: s.int() });
const page = (): Node => document.createElement("div");
export const a = contract("a", {
  "a.x": { method: "POST", path: "/x", body: Nothing, output: N },
  "a.p": { path: "/p" },
});
const pageAct = action(a, "a.p", { input: Nothing }, async () => ok(null));
const apiAct = action(a, "a.x", {}, async () => ok({ n: 1 }));
export const routes = manifest(a, { "a.x": { action: apiAct }, "a.p": { component: page, POST: pageAct } });
`;
const CONTROL = `${PROBE_HEAD}export const pageGoes = action(a, "a.p", { input: Nothing }, async () => ok(a.href("a.p")));
export const apiReads = action(a, "a.x", {}, async (_body, { bearer }) => (bearer === undefined ? ok({ n: 1 }) : ok({ n: 2 })));
export const readsUser = action(a, "a.p", { input: Nothing }, async (_input, { caller, user }) => {
  const who: string = user;
  const from: string = caller;
  return who === from ? ok(null) : ok(null);
});
`;
const BAD = {
  wrongOutputValue: CONTROL.replace("async () => ok({ n: 1 })", 'async () => ok("/x")'),
  pageWithOutput: CONTROL.replace(
    '"a.p", { input: Nothing }, async () => ok(null))',
    '"a.p", { input: Nothing, output: N }, async () => ok(null))',
  ),
  userIsNotAString: `${CONTROL}export const userAsNumber = action(a, "a.p", { input: Nothing }, async (_input, { user }) => {
  const n: number = user;
  return n > 0 ? ok(null) : ok(null);
});
`,
  pageReadsBearer: `${CONTROL}export const pageReads = action(a, "a.p", { input: Nothing }, async (_input, { bearer }) =>
  bearer === undefined ? ok(null) : ok(null),
);
`,
} as const;
const Nothing = s.object({});
const N = s.object({ n: s.int() });
const KINDS = ["action", "loader"] as const;
const codeOf = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return typeof e === "object" && e !== null && "code" in e ? e.code : "no-code";
  }
  return null;
};
const messageOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return "";
};
describe("k.privacy E1113", () => {
  const SECRET = s.secret(s.string());
  const outputs: readonly {
    readonly name: string;
    readonly bad: unknown;
    readonly clean: unknown;
    readonly path: string;
  }[] = [
    { name: "a field", bad: s.object({ t: SECRET }), clean: s.object({ t: s.string() }), path: "t" },
    {
      name: "an array item",
      bad: s.object({ t: s.array(SECRET) }),
      clean: s.object({ t: s.array(s.string()) }),
      path: "t",
    },
    {
      name: "a nested field",
      bad: s.object({ a: s.object({ b: SECRET }) }),
      clean: s.object({ a: s.object({ b: s.string() }) }),
      path: "a.b",
    },
  ];
  const declare = (kind: "action" | "loader", output: unknown): (() => unknown) => {
    const api = {
      method: kind === "action" ? "POST" : "GET",
      path: "/x",
      output,
      ...(kind === "action" ? { body: Nothing } : {}),
    };
    return () => {
      const c = Reflect.apply(contract, undefined, ["a", { "a.x": api }]);
      return Reflect.apply(kind === "action" ? action : loader, undefined, [c, "a.x", {}, async () => ok({})]);
    };
  };

  it("An API entry or page loader whose `output` has an `s.secret` field throws E1113; with `s.string()`, none.", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KINDS), fc.constantFrom(...outputs), (kind, o) => {
        expect(codeOf(declare(kind, o.bad)), `${kind} with ${o.name}`).toBe("E1113");
        expect(codeOf(declare(kind, o.clean)), `${kind} with ${o.name}`).toBeNull();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("E1113 an `s.secret` in an `output`, thrown by `contract` or `loader` (k.routes; fix: none).", () => {
    for (const kind of KINDS) {
      for (const o of outputs) {
        const message = messageOf(declare(kind, o.bad));
        expect(message).toContain("E1113");
        if (o.name !== "an array item") expect(message).toContain(o.path);
        expect(message).not.toContain("[object");
      }
    }
    // a page loader declares its view's `output` on the handler (k.contract Handlers): E1113 reads it there too
    const pageC = contract("a", { "a.p": { path: "/p" } });
    const pageLoader = (output: unknown) => () =>
      Reflect.apply(loader, undefined, [pageC, "a.p", { output }, async () => ok({})]);
    expect(codeOf(pageLoader(s.object({ t: SECRET })))).toBe("E1113");
    expect(codeOf(pageLoader(s.object({ t: s.string() })))).toBeNull();
  });

  it("A `loader` or `action` `output` holds no `s.secret` (E1113); a secret leaves as `reveal(secret)` in an `s.string()` field (k.api).", () => {
    expect(codeOf(declare("action", s.object({ token: s.string() })))).toBeNull();
    expect(codeOf(declare("action", s.object({ token: SECRET })))).toBe("E1113");
  });
});

describe("k.guards bearer", () => {
  it(
    "`caller` and `user` are k.server's and k.user's (`''` if none or client-only); `bearer` is k.api's (`undefined` off an API route; a redirect hop's guards get none).",
    () => {
      expect(typeErrors(CONTROL)).toEqual([]);
      expect(typeErrors(BAD.pageReadsBearer).length).toBeGreaterThan(0);
      expect(typeErrors(BAD.userIsNotAString).length).toBeGreaterThan(0);
    },
    fixedTime(120_000),
  );

  it(
    "an API action returning a value its entry's `output` refuses, and a page action declaring an `output`, do not compile",
    () => {
      expect(typeErrors(CONTROL)).toEqual([]);
      expect(typeErrors(BAD.wrongOutputValue).length).toBeGreaterThan(0);
      expect(typeErrors(BAD.pageWithOutput).length).toBeGreaterThan(0);
    },
    fixedTime(120_000),
  );
});
