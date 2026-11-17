// @vitest-environment happy-dom
// Spec: k.api, Output "An API route's action declares `output`, a schema, and a page's action does not (E1512): `action({ input, output, params?, stores? }, fn)`, whose `fn` returns `Result<T, KeelError>` for `output`'s type `T`."
// Spec: k.api, Rules "E1512 an action without `output` on an API route, or with one on a page; a type error, and `routes.actions` throws it; no fix"
// Spec: k.api, Conformance "An API route's action without `output`, and a page's with one, do not compile, and `routes.actions` throws E1512."
// Spec: k.privacy, Secrets "A `loader` or `action` `output` holds no `s.secret` (E1113); a secret leaves as `reveal(secret)` in an `s.string()` field (k.api)."
// Spec: k.privacy, Rules "E1113 an `s.secret` node in a `loader` or `action` `output`, thrown at declaration (fix: none)."
// Spec: k.privacy, Conformance "An `action` or `loader` whose `output` has an `s.secret` field throws E1113; with `s.string()`, none."
// Spec: k.guards, Guards "`caller` is k.server's `caller` (`''` if none or client-only); `bearer` is k.api's (`undefined` off an API route; a redirect hop's guards get none)."
// Seed: 1337.
// The `endpoints` case of the RFC list (`@keel/services` takes no E1113) lives in packages/services/conformance/bearer-0104.test.ts: this package does not depend on `@keel/services`.
// Compile failures are asserted by type-checking in-memory modules (never written to disk) with packages/router/tsconfig.json: a control module
// that binds and reads everything correctly has no error, and each bad module, one line away from the control, has at least one.
// The run-time throw is reached over a widened record the types do not see.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { action, loader, manifest } from "@keel/router";
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
import { ok, s } from "@keel/schema";
const Nothing = s.object({});
const N = s.object({ n: s.int() });
const page = (): Node => document.createElement("div");
const pageAct = action({ input: Nothing }, async () => ok(null));
const apiAct = action({ input: Nothing, output: N }, async () => ok({ n: 1 }));
const routes = manifest({ "api.x": { api: true, path: "/x" }, "app.p": { path: "/p", component: page } });
`;
const CONTROL = `${PROBE_HEAD}routes.actions({ "api.x": { POST: apiAct }, "app.p": { POST: pageAct } });
export const right = action({ input: Nothing, output: N }, async () => ok({ n: 2 }));
export const apiReads = action({ input: Nothing, output: Nothing }, async (_input, { bearer }) =>
  bearer === undefined ? ok({}) : ok({}),
);
export const pageGoes = action({ input: Nothing }, async () => ok(routes.href("app.p")));
`;
const BAD = {
  apiWithoutOutput: CONTROL.replace('"api.x": { POST: apiAct }', '"api.x": { POST: pageAct }'),
  pageWithOutput: CONTROL.replace('"app.p": { POST: pageAct }', '"app.p": { POST: apiAct }'),
  wrongOutputValue: CONTROL.replace("async () => ok({ n: 2 })", 'async () => ok("/x")'),
  pageReadsBearer: `${CONTROL}export const pageReads = action({ input: Nothing }, async (_input, { bearer }) =>
  bearer === undefined ? ok(null) : ok(null),
);
`,
} as const;
const Nothing = s.object({});
const N = s.object({ n: s.int() });
const page = (): Node => document.createElement("div");
const pageAct = action({ input: Nothing }, async () => ok(null));
const apiAct = action({ input: Nothing, output: N }, async () => ok({ n: 1 }));
const KINDS = ["action", "loader"] as const;
const VERBS = ["POST", "PUT", "PATCH", "DELETE"] as const;

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
const table = () =>
  manifest({
    "api.x": { api: true, path: "/x" },
    "app.p": { path: "/p", component: page },
  });
/** `routes.actions` over a table the types would refuse. */
const bind = (id: string, verb: string, entry: unknown): unknown => {
  const routes = table();
  const widened: Readonly<Record<string, unknown>> = { [id]: { [verb]: entry } };
  return codeOf(() => Reflect.apply(routes.actions, routes, [widened]));
};

describe("k.api E1512", () => {
  it("An API route's action without `output`, and a page's with one, do not compile, and `routes.actions` throws E1512.", () => {
    expect(typeErrors(CONTROL)).toEqual([]);
    expect(typeErrors(BAD.apiWithoutOutput).length).toBeGreaterThan(0);
    expect(typeErrors(BAD.pageWithOutput).length).toBeGreaterThan(0);
    expect(codeOf(() => table().actions({ "api.x": { POST: apiAct }, "app.p": { POST: pageAct } }))).toBeNull();
    fc.assert(
      fc.property(fc.constantFrom(...VERBS), (verb) => {
        expect(bind("api.x", verb, pageAct)).toBe("E1512");
        expect(bind("app.p", verb, apiAct)).toBe("E1512");
        expect(bind("api.x", verb, apiAct)).toBeNull();
        expect(bind("app.p", verb, pageAct)).toBeNull();
      }),
      { seed: SEED, numRuns: 20 },
    );
  }, 120_000);

  it("An API route's action declares `output`, a schema, and a page's action does not (E1512): `action({ input, output, params?, stores? }, fn)`, whose `fn` returns `Result<T, KeelError>` for `output`'s type `T`.", () => {
    expect(typeErrors(CONTROL)).toEqual([]);
    expect(typeErrors(BAD.wrongOutputValue).length).toBeGreaterThan(0);
    const right = action({ input: Nothing, output: N }, async () => ok({ n: 2 }));
    expect(right.output.parse({ n: 2 }).ok).toBe(true);
    expect(typeErrors(BAD.pageReadsBearer).length).toBeGreaterThan(0);
  }, 120_000);

  it("E1512 an action without `output` on an API route, or with one on a page; a type error, and `routes.actions` throws it; no fix", () => {
    for (const verb of VERBS) {
      const messages = [bind("api.x", verb, pageAct), bind("app.p", verb, apiAct)];
      expect(messages).toEqual(["E1512", "E1512"]);
    }
    const routes = table();
    const widened: Readonly<Record<string, unknown>> = { "api.x": { POST: pageAct } };
    const message = messageOf(() => Reflect.apply(routes.actions, routes, [widened]));
    expect(message).toContain("E1512");
    expect(message).toContain("api.x");
    expect(message.length).toBeLessThan(90);
    const clean = table();
    expect(codeOf(() => clean.actions({ "api.x": { POST: apiAct } }))).toBeNull();
  });
});

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
    const decl = kind === "action" ? { input: Nothing, output } : { output };
    const fn = kind === "action" ? async () => ok({}) : async () => ok({});
    return () => Reflect.apply(kind === "action" ? action : loader, undefined, [decl, fn]);
  };

  it("An `action` or `loader` whose `output` has an `s.secret` field throws E1113; with `s.string()`, none.", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KINDS), fc.constantFrom(...outputs), (kind, o) => {
        expect(codeOf(declare(kind, o.bad)), `${kind} with ${o.name}`).toBe("E1113");
        expect(codeOf(declare(kind, o.clean)), `${kind} with ${o.name}`).toBeNull();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("E1113 an `s.secret` node in a `loader` or `action` `output`, thrown at declaration (fix: none).", () => {
    for (const kind of KINDS) {
      for (const o of outputs) {
        const message = messageOf(declare(kind, o.bad));
        expect(message).toContain("E1113");
        if (o.name !== "an array item") expect(message).toContain(o.path);
        expect(message).not.toContain("[object");
      }
    }
    expect(
      codeOf(() => action({ input: Nothing, output: s.object({ t: s.string() }) }, async () => ok({ t: "x" }))),
    ).toBeNull();
    expect(codeOf(() => loader({ output: s.object({ t: s.string() }) }, async () => ok({ t: "x" })))).toBeNull();
  });

  it("A `loader` or `action` `output` holds no `s.secret` (E1113); a secret leaves as `reveal(secret)` in an `s.string()` field (k.api).", () => {
    const withToken = action({ input: Nothing, output: s.object({ token: s.string() }) }, async () =>
      ok({ token: "x" }),
    );
    expect(withToken.output.parse({ token: "x" }).ok).toBe(true);
    expect(codeOf(declare("action", s.object({ token: SECRET })))).toBe("E1113");
  });
});

describe("k.guards bearer", () => {
  it("`caller` is k.server's `caller` (`''` if none or client-only); `bearer` is k.api's (`undefined` off an API route; a redirect hop's guards get none).", () => {
    expect(typeErrors(CONTROL)).toEqual([]);
    expect(typeErrors(BAD.pageReadsBearer).length).toBeGreaterThan(0);
    const apiReads = action({ input: Nothing, output: Nothing }, async (_input, at) => {
      expect(at.bearer === undefined || typeof at.bearer === "object").toBe(true);
      return ok({});
    });
    expect(apiReads.output.parse({}).ok).toBe(true);
  }, 120_000);
});
