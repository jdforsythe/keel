// @vitest-environment happy-dom
// Spec: k.router, clause "An action returning `ok(routes.href(id))` compiles unannotated and navigates to `id`; an entry with `actions` throws E1505."
// Seed 1337 (fast-check, in a comment per TESTING.md): the navigation and E1505 properties generate route tables, verbs
// and targets; the type probes are fixed (the compiler is the oracle for the type clause).
// Part 1 type-checks in-memory modules (never written to disk) with packages/router/tsconfig.json; part 2 submits a Form
// in a mounted router; part 3 hands `manifest` an entry that carries `actions`.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCtx } from "@keel/ctx";
import { Form, action, createRouter, manifest } from "@keel/router";
import { mount } from "@keel/runtime-dom";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";

const CLAUSE =
  "An action returning `ok(routes.href(id))` compiles unannotated and navigates to `id`; an entry with `actions` throws E1505.";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const at = (name: string): string => path.join(HERE, name);
const ROUTES = at("__href_probe_routes__.ts");
const SERVER = at("__href_probe_save__.server.ts");

const serverModule = `import { action } from "@keel/router";
import { ok, s } from "@keel/schema";
import { P, routes } from "./__href_probe_routes__.ts";
export const save = action({ input: s.object({ title: s.string() }), params: P }, async (_input, { params }) => {
  void params.id;
  return ok(routes.href("p.list"));
});
`;

const ROUTES_HEAD = `import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { save } from "./__href_probe_save__.server.ts";
export const P = s.object({ id: s.int() });
const page = (): Node => document.createElement("div");
`;

const routesWith = (tail: string, entryExtra = ""): string => `${ROUTES_HEAD}export const routes = manifest({
  "p.list": { path: "/p", component: page },
  "p.edit": { path: "/p/:id", params: P, ${entryExtra}component: page },
});
${tail}
`;

type Diag = { file: string; code: number; text: string };

/** Error diagnostics in the probe files for the given in-memory sources. */
function typeErrors(files: Record<string, string>): Diag[] {
  const configPath = path.join(HERE, "../tsconfig.json");
  const read = ts.readConfigFile(configPath, (p) => ts.sys.readFile(p));
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configPath));
  const options: ts.CompilerOptions = { ...parsed.options, noEmit: true };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  const virtual = (name: string): string | undefined => files[path.resolve(name)];
  host.getSourceFile = (name, languageVersion, onError, shouldCreate) => {
    const src = virtual(name);
    return src === undefined
      ? getSourceFile(name, languageVersion, onError, shouldCreate)
      : ts.createSourceFile(name, src, languageVersion, true);
  };
  host.fileExists = (name) => virtual(name) !== undefined || fileExists(name);
  host.readFile = (name) => virtual(name) ?? readFile(name);
  const program = ts.createProgram(Object.keys(files), options, host);
  const out: Diag[] = [];
  for (const file of Object.keys(files)) {
    const sf = program.getSourceFile(file);
    if (sf === undefined) throw new Error(`probe source file was not created: ${file}`);
    for (const d of ts.getPreEmitDiagnostics(program, sf)) {
      if (d.category !== ts.DiagnosticCategory.Error) continue;
      out.push({ file: path.basename(file), code: d.code, text: ts.flattenDiagnosticMessageText(d.messageText, " ") });
    }
  }
  return out;
}

describe(`k.router: ${CLAUSE}`, () => {
  let good: Diag[] = [];
  let oldShape: Diag[] = [];
  let unknownId: Diag[] = [];
  let wrongVerb: Diag[] = [];

  beforeAll(() => {
    good = typeErrors({
      [ROUTES]: routesWith(`routes.actions({ "p.edit": { POST: save } });`),
      [SERVER]: serverModule,
    });
    oldShape = typeErrors({
      [ROUTES]: routesWith("", "actions: { POST: save }, "),
      [SERVER]: serverModule,
    });
    unknownId = typeErrors({
      [ROUTES]: routesWith(`routes.actions({ "p.nope": { POST: save } });`),
      [SERVER]: serverModule,
    });
    wrongVerb = typeErrors({
      [ROUTES]: routesWith(`routes.actions({ "p.edit": { GET: save } });`),
      [SERVER]: serverModule,
    });
  }, 120_000);

  it(`${CLAUSE} Compiles unannotated: the probe modules resolve their imports`, () => {
    expect(good.filter((e) => e.code === 2307)).toEqual([]);
  });

  it(`${CLAUSE} Compiles unannotated: an action returning ok(routes.href(id)) has no error diagnostics`, () => {
    expect(good).toEqual([]);
  });

  it(`${CLAUSE} Compiles unannotated: no implicit-any circularity (TS7022, TS7023, TS7024)`, () => {
    expect(good.filter((e) => [7022, 7023, 7024].includes(e.code))).toEqual([]);
  });

  it(`${CLAUSE} An entry with actions inside the manifest does not compile`, () => {
    expect(oldShape.filter((e) => e.code !== 2307).length).toBeGreaterThan(0);
  });

  it(`${CLAUSE} routes.actions with an unknown route id does not compile`, () => {
    expect(unknownId.filter((e) => e.code !== 2307).length).toBeGreaterThan(0);
  });

  it(`${CLAUSE} routes.actions keyed by GET does not compile`, () => {
    expect(wrongVerb.filter((e) => e.code !== 2307).length).toBeGreaterThan(0);
  });
});

describe(`k.router: ${CLAUSE} (navigation)`, () => {
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 64; i++) await Promise.resolve();
  };

  it(`${CLAUSE} Navigates to id: submitting a Form whose action returns ok(routes.href(id)) lands on id`, async () => {
    const EditPage = (): Node =>
      Form({ method: "POST", action: routes.href("n.edit"), children: () => [document.createElement("span")] });
    const ListPage = (): Node => document.createElement("section");
    const routes = manifest({
      "n.list": { path: "/n", component: ListPage },
      "n.edit": { path: "/n/edit", component: EditPage },
    });
    routes.actions({
      "n.edit": { POST: action({ input: s.object({}) }, async () => ok(routes.href("n.list"))) },
    });

    const entries: { url: string; key: string | undefined }[] = [{ url: "/n/edit", key: undefined }];
    const history = {
      push: (url: string, key: string): void => {
        entries.push({ url, key });
      },
      replace: (url: string, key: string): void => {
        entries[entries.length - 1] = { url, key };
      },
      current: (): string => entries[entries.length - 1]?.url ?? "/n/edit",
      onPop: (_fn: (url: string, key?: string) => void): void => {},
    };
    const router = createRouter(routes, { ctx: createCtx({ mode: "sim", seed: 1337 }), history });
    const host = document.createElement("div");
    document.body.append(host);
    const unmount = mount(router.App, host);
    await settle();
    expect(router.route.get().id).toBe("n.edit");

    const form = host.querySelector("form");
    if (form === null) throw new Error("no form rendered");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();

    expect(router.route.get().id).toBe("n.list");
    unmount();
    router.dispose();
    host.remove();
  });
});

describe(`k.router: ${CLAUSE} (property)`, () => {
  const VERBS = ["POST", "PUT", "PATCH", "DELETE"] as const;
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 64; i++) await Promise.resolve();
  };
  const segments = fc.uniqueArray(fc.stringMatching(/^[a-z]{1,8}$/), { minLength: 2, maxLength: 5 });
  const table = segments.chain((segs) =>
    fc.record({
      segs: fc.constant(segs),
      from: fc.nat({ max: segs.length - 1 }),
      to: fc.nat({ max: segs.length - 1 }),
      verb: fc.constantFrom(...VERBS),
    }),
  );

  it(`${CLAUSE} Property: for any route table, verb and target id, a Form whose routes.actions action returns ok(routes.href(id)) lands on id`, async () => {
    await fc.assert(
      fc.asyncProperty(table, async ({ segs, from, to, verb }) => {
        const ids = segs.map((g) => `p.${g}`);
        const source = ids[from] ?? "";
        const target = ids[to] ?? "";
        const entries = Object.fromEntries(
          segs.map((g, i) => [
            `p.${g}`,
            {
              path: `/${g}`,
              component: (): Node =>
                i === from
                  ? Form({ method: verb, action: routes.href(source), children: () => [] })
                  : document.createElement("section"),
            },
          ]),
        );
        const routes = manifest(entries);
        routes.actions({ [source]: { [verb]: action({ input: s.object({}) }, async () => ok(routes.href(target))) } });
        const at = [`/${segs[from] ?? ""}`];
        const history = {
          push: (url: string): void => void at.push(url),
          replace: (url: string): void => {
            at[at.length - 1] = url;
          },
          current: (): string => at[at.length - 1] ?? "/",
          onPop: (_fn: (url: string, key?: string) => void): void => {},
        };
        const router = createRouter(routes, { ctx: createCtx({ mode: "sim", seed: 1337 }), history });
        const host = document.createElement("div");
        document.body.append(host);
        const unmount = mount(router.App, host);
        await settle();
        const form = host.querySelector("form");
        if (form === null) throw new Error("no form rendered");
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await settle();
        const landed = router.route.get().id;
        unmount();
        router.dispose();
        host.remove();
        expect(landed).toBe(target);
      }),
      { seed: 1337, numRuns: 40 },
    );
  });

  it(`${CLAUSE} Property: an entry with actions under any verb throws E1505, wherever it sits in the table`, () => {
    const page = (): Node => document.createElement("div");
    const a = action({ input: s.object({}) }, async () => ok(null));
    fc.assert(
      fc.property(table, ({ segs, from, verb }) => {
        const entries: Record<string, unknown> = Object.fromEntries(
          segs.map((g, i) => [
            `q.${g}`,
            i === from
              ? { path: `/${g}`, actions: { [verb]: a }, component: page }
              : { path: `/${g}`, component: page },
          ]),
        );
        let code: unknown = null;
        try {
          Reflect.apply(manifest, undefined, [entries]);
        } catch (e) {
          code = typeof e === "object" && e !== null && "code" in e ? e.code : "no-code";
        }
        expect(code).toBe("E1505");
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});

describe(`k.router: ${CLAUSE} (E1505)`, () => {
  const page = (): Node => document.createElement("div");
  const a = action({ input: s.object({}) }, async () => ok(null));

  it(`${CLAUSE} An entry with actions throws E1505`, () => {
    const entries: Record<string, unknown> = { "e.one": { path: "/e", actions: { POST: a }, component: page } };
    let thrown: unknown = null;
    try {
      Reflect.apply(manifest, undefined, [entries]);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown instanceof Error && "code" in thrown ? thrown.code : "no-code").toBe("E1505");
  });

  it(`${CLAUSE} routes.actions with a value that is not an action throws E1505`, () => {
    const m = manifest({ "e.two": { path: "/e2", component: page } });
    for (const bad of [undefined, {}, "x", { kind: "keel.action", run: () => ok(null) }]) {
      let thrown: unknown = null;
      try {
        Reflect.apply(m.actions, m, [{ "e.two": { POST: bad } }]);
      } catch (e) {
        thrown = e;
      }
      expect(thrown instanceof Error && "code" in thrown ? thrown.code : "no-code").toBe("E1505");
    }
  });
});
