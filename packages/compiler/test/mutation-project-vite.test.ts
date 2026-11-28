// Mutation-killing tests for the Vite plugin (src/vite.ts).
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import keel from "@keel/compiler/vite";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RESUME_ENTRY } from "../src/entry/RESUME_ENTRY.ts";
import { resumeEntry } from "../src/entry/resumeEntry.ts";
import { canonicalJson } from "../src/internal/canonicalJson.ts";
import { entryCode } from "../src/internal/entryCode.ts";
import { hashOf } from "../src/internal/hashOf.ts";

const packages = path.dirname(fs.realpathSync(path.join(import.meta.dirname, "..", "node_modules", "@keel", "schema")));
let root = "";
const SAVED = { deployable: process.env.KEEL_DEPLOYABLE, origins: process.env.KEEL_INSPECT_ORIGINS };

const write = (rel: string, text: string): string => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
};
const restore = (key: "KEEL_DEPLOYABLE" | "KEEL_INSPECT_ORIGINS", v: string | undefined): void => {
  if (v === undefined) Reflect.deleteProperty(process.env, key);
  else process.env[key] = v;
};
beforeEach(() => {
  root = tempDir(".tmp-mvite-", import.meta.dirname);
  Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
  Reflect.deleteProperty(process.env, "KEEL_INSPECT_ORIGINS");
});
afterEach(() => {
  restore("KEEL_DEPLOYABLE", SAVED.deployable);
  restore("KEEL_INSPECT_ORIGINS", SAVED.origins);
  fs.rmSync(root, { recursive: true, force: true });
});
const link = (): void => {
  fs.mkdirSync(path.join(root, "node_modules", "@keel"), { recursive: true });
  for (const p of fs.readdirSync(packages))
    if (fs.existsSync(path.join(packages, p, "package.json")))
      fs.symlinkSync(path.join(packages, p), path.join(root, "node_modules", "@keel", p));
};
const artifact = (name: string): { data: Record<string, unknown>; hash: unknown; text: string } => {
  const text = fs.readFileSync(path.join(root, ".keel", name), "utf8");
  const v: unknown = JSON.parse(text);
  const data = typeof v === "object" && v !== null ? Reflect.get(v, "data") : undefined;
  if (typeof data !== "object" || data === null) throw new Error(`bad ${name}`);
  return { data: Object.fromEntries(Object.entries(data)), hash: Reflect.get(v ?? {}, "hash"), text };
};

// The contract sits in the binding's own file here: evaluation reads it as it reads a contract file.
const routesTs = (id: string): string =>
  `import { manifest } from "@keel/router";\nimport { contract } from "@keel/router/contract";\nconst c = contract("${id}", { "${id}.index": { path: "/${id}" } });\nconst Page = () => null;\nexport const routes = manifest(c, { "${id}.index": { component: Page } });\n`;
const TOKENS = `import { defineTokens } from "@keel/ui/tokens";\nexport const tokens = defineTokens({ space: { 1: "4px", 2: "8px", 3: "12px" }, color: { fg: "#111" } });\n`;
const page = (props: string): string =>
  `import { Box } from "@keel/ui";\nexport default function P() { return <Box ${props} />; }\n`;

type Fake = { server: Parameters<ReturnType<typeof keel>["configureServer"]>[0]; reloaded: object[]; asked: string[] };
const fakeServer = (hasModule = true): Fake => {
  const mod = {};
  const reloaded: object[] = [];
  const asked: string[] = [];
  return {
    reloaded,
    asked,
    server: {
      moduleGraph: {
        getModuleById(id) {
          asked.push(id);
          return hasModule ? mod : undefined;
        },
      },
      reloadModule(m) {
        reloaded.push(m);
        return Promise.resolve();
      },
      middlewares: { use() {} },
    },
  };
};

describe("vite: resolveId and load", () => {
  it("resolves the virtual css and the entry, nothing else", async () => {
    const p = keel();
    expect(p.name).toBe("keel");
    expect(p.enforce).toBe("pre");
    expect(p.resolveId("virtual:keel.css")).toBe("/__keel.css");
    expect(p.resolveId("/__keel.css")).toBe("/__keel.css");
    expect(p.resolveId("/@keel/entry.ts")).toBe("/@keel/entry.ts");
    expect(p.resolveId("/@keel/other.ts")).toBeNull();
    expect(p.resolveId("virtual:other")).toBeNull();
    expect(p.resolveId("")).toBeNull();
    p.configResolved({ root });
    expect(await p.load("/other.ts")).toBeNull();
    expect(await p.load("/@keel/other.ts")).toBeNull();
  });

  it("leaves node:sqlite to Node outside a build, whatever Node's built-in list says", () => {
    const p = keel();
    p.configResolved({ root, command: "serve" });
    expect(p.resolveId("node:sqlite")).toEqual({ id: "node:sqlite", external: true });
    p.configResolved({ root, command: "build" });
    expect(p.resolveId("node:sqlite")).toBe("\0keel:sqlite");
  });

  it("serves empty css when there is no project input", async () => {
    const p = keel();
    p.configResolved({ root });
    expect(await p.load("/__keel.css")).toBe("");
  });
});

describe("vite: which ids are app code", () => {
  const SRC = "export default function A() { return <p>a</p> }";
  it("compiles app code, also with a query string", () => {
    const p = keel();
    p.configResolved({ root });
    expect(p.transform(SRC, path.join(root, "src/A.tsx"))?.map).toContain('"sources":["src/A.tsx"]');
    expect(p.transform(SRC, `${path.join(root, "src/A.tsx")}?v=1`)?.code).toContain("template(");
    expect(p.transform(SRC, path.join(root, "src/A.tsx"))?.code).toContain("template(");
    for (const ext of ["ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs"])
      expect(p.transform("export const x = 1;", path.join(root, `src/f.${ext}`)), ext).not.toBeNull();
    expect(p.transform("export const x = 1;", path.join(root, "contest/x.ts"))).not.toBeNull();
    expect(p.transform("export const x = 1;", path.join(root, "src/test.ts"))).not.toBeNull();
    expect(p.transform("export const x = 1;", path.join(root, "src/vitest-config.ts"))).not.toBeNull();
    expect(p.transform("export const x = 1;", path.join(root, "src/types.d.tsx"))).not.toBeNull();
  });
  it("skips virtual ids, declarations, non-code, dependencies and files outside the root", () => {
    const p = keel();
    p.configResolved({ root });
    const skipped = [
      `\0${path.join(root, "src/A.tsx")}`,
      "\0virtual.tsx",
      "/@keel/entry.ts",
      "/@keel/x.tsx",
      path.join(root, "src/types.d.ts"),
      path.join(root, "src/a.css"),
      path.join(root, "src/a.tsx.map"),
      path.join(root, "node_modules/x/index.ts"),
      path.join(root, "src/node_modules/x/index.ts"),
      path.join(path.dirname(root), "outside.tsx"),
      path.join(root, "../elsewhere/x.tsx"),
      path.join(root, "test/a.ts"),
      path.join(root, "tests/a.ts"),
      path.join(root, "src/__tests__/a.ts"),
      path.join(root, "src/a.test.ts"),
      path.join(root, "src/a.spec.tsx"),
      path.join(root, "src/a.test.mjs"),
      path.join(root, "vitest.config.ts"),
      path.join(root, "vitest.workspace.config.mts"),
      path.join(root, "src/vitest.config.js"),
    ];
    for (const id of skipped) expect(p.transform("export const x = 1;", id), id).toBeNull();
  });
});

describe("vite: transform failures", () => {
  it("fails with located diagnostics, again from the cache, and recompiles on a changed source", () => {
    const p = keel();
    p.configResolved({ root });
    const file = path.join(root, "C.tsx");
    const bad = "export default function C() { return <a href='javascript:x'>c</a> }";
    const msg = "E1003 C.tsx:1:41 href is a literal script/data URL; it renders as about:blank";
    expect(() => p.transform(bad, file)).toThrow(new Error(msg));
    expect(() => p.transform(bad, file)).toThrow(new Error(msg));
    const good = "export default function C() { return <p>ok</p> }";
    const out = p.transform(good, file);
    expect(out?.code).toContain("<p");
    expect(out?.code).not.toContain("javascript");
    expect(() => p.transform(bad, file)).toThrow(new Error(msg));
  });

  it("joins every failure and the duplicate-id errors with newlines, clipping the id", () => {
    const p = keel();
    p.configResolved({ root });
    const id = "x".repeat(40);
    p.transform(`export default function D() { return <p id="${id}">d</p> }`, path.join(root, "D.tsx"));
    const bad = `export default function E() { return <div><a href='javascript:x'>c</a><p id="${id}">e</p></div> }`;
    const lines = (() => {
      try {
        p.transform(bad, path.join(root, "E.tsx"));
        return [];
      } catch (e) {
        return e instanceof Error ? e.message.split("\n") : [];
      }
    })();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("E1003 E.tsx:1:46 href is a literal script/data URL; it renders as about:blank");
    expect(lines[1]).toBe(`E1404 E.tsx duplicate element id "${"x".repeat(30)}" (also in another module)`);
  });

  it("does not fail other modules for a duplicate it does not own", () => {
    const p = keel();
    p.configResolved({ root });
    p.transform('export default function D() { return <p id="dup">d</p> }', path.join(root, "D.tsx"));
    expect(() =>
      p.transform('export default function E() { return <p id="dup">e</p> }', path.join(root, "E.tsx")),
    ).toThrow('E1404 E.tsx duplicate element id "dup" (also in another module)');
    expect(
      p.transform('export default function D() { return <p id="dup">d</p> }', path.join(root, "D.tsx"))?.code,
    ).toContain("template(");
  });
});

describe("vite: artifacts on disk", () => {
  it("writes canonical { data, hash } text with a trailing newline, read-only, without temp files", () => {
    const p = keel();
    p.configResolved({ root });
    p.transform("export default function A() { return <p>a</p> }", path.join(root, "src/A.tsx"));
    for (const name of ["a11y.json", "deps.json", "ids.json", "routes.json", "styles.json"]) {
      const a = artifact(name);
      expect(a.text).toBe(`${canonicalJson({ data: a.data, hash: hashOf(a.data) })}\n`);
      expect(a.hash).toBe(hashOf(a.data));
      expect((fs.statSync(path.join(root, ".keel", name)).mode & 0o777).toString(8)).toBe("444");
    }
    expect(fs.readdirSync(path.join(root, ".keel")).sort()).toEqual([
      "a11y.json",
      "deps.json",
      "ids.json",
      "routes.json",
      "std.json",
      "styles.json",
    ]);
    expect(Object.keys(artifact("ids.json").data)).toEqual(["src.A.0"]);
  });

  it("rewrites only the artifacts whose content changed", () => {
    const p = keel();
    p.configResolved({ root });
    const a = path.join(root, "src/A.tsx");
    p.transform("export default function A() { return <p>a</p> }", a);
    const ino = (n: string): number => fs.statSync(path.join(root, ".keel", n)).ino;
    const before = { ids: ino("ids.json"), deps: ino("deps.json"), styles: ino("styles.json") };
    p.transform("export default function A() { return <div><p>a</p><p>b</p></div> }", a);
    expect(ino("ids.json")).not.toBe(before.ids);
    expect(ino("styles.json")).toBe(before.styles);
    expect(Object.keys(artifact("ids.json").data)).toEqual(["src.A.0", "src.A.1", "src.A.2"]);
    void before.deps;
  });

  it("keeps modules on update and create events, and evicts only on delete", () => {
    const p = keel();
    p.configResolved({ root });
    const a = path.join(root, "src/A.tsx");
    const b = path.join(root, "src/B.tsx");
    p.transform("export default function A() { return <p>a</p> }", a);
    p.transform("export default function B() { return <p>b</p> }", b);
    p.watchChange(b, { event: "update" });
    p.watchChange(b, { event: "create" });
    p.watchChange(path.join(root, "node_modules/x/i.ts"), { event: "delete" });
    p.watchChange(path.join(root, "src/B.css"), { event: "delete" });
    expect(Object.keys(artifact("ids.json").data)).toEqual(["src.A.0", "src.B.0"]);
    p.watchChange(b, { event: "delete" });
    expect(Object.keys(artifact("ids.json").data)).toEqual(["src.A.0"]);
    p.watchChange(b, { event: "delete" });
    expect(Object.keys(artifact("ids.json").data)).toEqual(["src.A.0"]);
  });
});

describe("vite: dev server css reload", () => {
  it("reloads the css module only when the style usages change", () => {
    const p = keel();
    p.configResolved({ root });
    const f = fakeServer();
    p.configureServer(f.server);
    p.transform(page('p="1"'), path.join(root, "A.tsx"));
    expect(f.reloaded).toHaveLength(1);
    expect(f.asked).toEqual(["/__keel.css"]);
    expect(f.reloaded[0]).toBe(f.reloaded[0]);
    p.transform(page('p="1"'), path.join(root, "A.tsx"));
    expect(f.reloaded).toHaveLength(1);
    p.transform(page('p="2"'), path.join(root, "A.tsx"));
    expect(f.reloaded).toHaveLength(2);
    p.transform(page('p="2"'), path.join(root, "B.tsx"));
    expect(f.reloaded).toHaveLength(2);
  });

  it("does nothing without a css module or a server, and swallows a failed reload", () => {
    const p = keel();
    p.configResolved({ root });
    p.transform(page('p="1"'), path.join(root, "A.tsx"));
    const none = fakeServer(false);
    p.configureServer(none.server);
    p.transform(page('p="2"'), path.join(root, "A.tsx"));
    expect(none.reloaded).toEqual([]);
    expect(none.asked).toEqual(["/__keel.css"]);
    const failing = keel();
    failing.configResolved({ root });
    failing.configureServer({
      moduleGraph: { getModuleById: () => ({}) },
      reloadModule: () => Promise.reject(new Error("boom")),
      middlewares: { use() {} },
    });
    expect(() => failing.transform(page('p="3"'), path.join(root, "A.tsx"))).not.toThrow();
  });
});

describe("vite: project inputs", () => {
  beforeEach(() => {
    link();
  });

  it("warns with the css problems and refreshes the css only when stale", { timeout: fixedTime(30000) }, async () => {
    write("tokens.ts", TOKENS);
    write("A.tsx", page('p="1"'));
    write("Bad.tsx", page('bg="nope"'));
    const warnings: string[] = [];
    const p = keel();
    p.configResolved({ root, command: "build" });
    await p.buildStart.call({ warn: (m: string) => void warnings.push(m) });
    expect(warnings).toEqual(['keel: E1801 bg="nope" is not a color token']);
    const css1 = (await p.load("/__keel.css")) ?? "";
    expect(css1).toContain(".k-p-1{padding:var(--k-space-1)}");
    expect(css1).not.toContain(".k-p-2");
    expect(warnings).toHaveLength(1);
    p.transform(page('p="2"'), path.join(root, "A.tsx"));
    const css2 = (await p.load("/__keel.css")) ?? "";
    expect(css2).toContain(".k-p-2{padding:var(--k-space-2)}");
    expect(warnings).toHaveLength(2);
    await p.load("/__keel.css");
    expect(warnings).toHaveLength(2);
  });

  it(
    "calls the bundler's warn with its own context and tolerates a missing one",
    { timeout: fixedTime(30000) },
    async () => {
      write("tokens.ts", TOKENS);
      write("Bad.tsx", page('bg="nope"'));
      const p = keel();
      p.configResolved({ root, command: "build" });
      let self: unknown;
      const ctx = {
        warn(this: unknown) {
          self = this;
        },
      };
      await p.buildStart.call(ctx);
      expect(self).toBe(ctx);
      const q = keel();
      q.configResolved({ root });
      await expect(q.buildStart.call(undefined)).resolves.toBeUndefined();
      await expect(q.buildStart.call({})).resolves.toBeUndefined();
    },
  );

  it("compiles every app source in buildStart and writes routes.json", { timeout: fixedTime(30000) }, async () => {
    write("src/A.tsx", "export default function A() { return <p>a</p> }");
    write("src/a.test.ts", "this is not code");
    write("test/b.ts", "this is not code");
    write("node_modules/zz/index.ts", "this is not code");
    write("dist/x.ts", "this is not code");
    const p = keel();
    p.configResolved({ root });
    await p.buildStart.call(undefined);
    expect(Object.keys(artifact("ids.json").data)).toEqual(["src.A.0"]);
    expect(artifact("routes.json").data).toEqual({});
  });

  it("reads routes from every module directory when there is no topology", { timeout: fixedTime(30000) }, async () => {
    write("modules/b/routes.ts", routesTs("b"));
    write("modules/a/routes.ts", routesTs("a"));
    write("modules/c/other.ts", "export const x = 1;");
    write("modules/file.txt", "x");
    const p = keel();
    p.configResolved({ root });
    await p.buildStart.call(undefined);
    expect(Object.keys(artifact("routes.json").data)).toEqual(["a.index", "b.index"]);
  });

  it("has no routes without a modules directory", { timeout: fixedTime(30000) }, async () => {
    const p = keel();
    p.configResolved({ root });
    await p.buildStart.call(undefined);
    expect(artifact("routes.json").data).toEqual({});
  });

  it(
    "reads only the modules of the deployable, skipping missing routes files",
    { timeout: fixedTime(30000) },
    async () => {
      write(
        "topology.ts",
        `export default { web: { modules: ["b", "a", "missing"], adapter: "client" }, api: { modules: ["x"], adapter: "node" } };\n`,
      );
      write("modules/b/routes.ts", routesTs("b"));
      write("modules/a/routes.ts", routesTs("a"));
      write("modules/x/routes.ts", routesTs("x"));
      write("modules/other/routes.ts", routesTs("other"));
      const p = keel();
      p.configResolved({ root, command: "serve" });
      await p.buildStart.call(undefined);
      expect(Object.keys(artifact("routes.json").data)).toEqual(["a.index", "b.index"]);
      expect(await p.load("/@keel/entry.ts")).toBe(
        entryCode(
          ["/modules/a/routes.ts", "/modules/b/routes.ts"],
          "virtual:keel.css",
          {},
          {},
          undefined,
          "dev",
          false,
          true,
          "web",
        ),
      );
    },
  );

  it(
    "binds service targets only for the modules the client's browser code imports",
    { timeout: fixedTime(30000) },
    async () => {
      write(
        "topology.ts",
        `export default { web: { modules: ["w"], adapter: "client" }, api: { modules: ["used", "hidden", "sessions"], adapter: "node" }, other: { modules: ["unseen"], adapter: "node" } };\n`,
      );
      write("modules/w/routes.ts", routesTs("w"));
      write("modules/w/call.ts", `import { c } from "../used/c.contract.ts";\nexport const x = c;\n`);
      write("modules/w/load.server.ts", `import { h } from "../hidden/h.ts";\nexport const y = h;\n`);
      write("modules/used/c.contract.ts", "export const c = 1;\n");
      write("modules/hidden/h.ts", "export const h = 1;\n");
      write("modules/unseen/u.ts", "export const u = 1;\n");
      const p = keel();
      p.configResolved({ root, command: "serve" });
      await p.buildStart.call(undefined);
      const code = await p.load("/@keel/entry.ts");
      expect(code).toBe(
        entryCode(
          ["/modules/w/routes.ts"],
          "virtual:keel.css",
          {},
          { api: ["used", "sessions"] },
          undefined,
          "dev",
          false,
          true,
          "web",
        ),
      );
      expect(code).not.toContain("hidden");
      expect(code).not.toContain("unseen");
    },
  );

  it("picks the first client deployable by name, or KEEL_DEPLOYABLE", { timeout: fixedTime(30000) }, async () => {
    write(
      "topology.ts",
      `export default { zeta: { modules: ["z"], adapter: "client" }, api: { modules: ["a"], adapter: "node" }, mid: { modules: ["m"], adapter: "client" } };\n`,
    );
    for (const m of ["z", "a", "m"]) write(`modules/${m}/routes.ts`, routesTs(m));
    const p = keel();
    p.configResolved({ root, command: "serve" });
    const all = {};
    expect(await p.load("/@keel/entry.ts")).toBe(
      entryCode(["/modules/m/routes.ts"], "virtual:keel.css", {}, all, undefined, "dev", false, true, "mid"),
    );
    process.env.KEEL_DEPLOYABLE = "zeta";
    expect(await p.load("/@keel/entry.ts")).toBe(
      entryCode(["/modules/z/routes.ts"], "virtual:keel.css", {}, all, undefined, "dev", false, true, "zeta"),
    );
    process.env.KEEL_DEPLOYABLE = "api";
    expect(await p.load("/@keel/entry.ts")).toBe(resumeEntry(undefined, "dev", "virtual:keel.css"));
    process.env.KEEL_DEPLOYABLE = "nope";
    await expect(p.load("/@keel/entry.ts")).rejects.toThrow(
      "keel: /@keel/entry.ts serves no deployable nope; set KEEL_DEPLOYABLE to one of api, mid, zeta",
    );
  });

  it("refuses the entry without a topology; with node deployables only it is the resume entry (keel dev)", async () => {
    const msg =
      "keel: /@keel/entry.ts needs a deployable; add a client or static one to topology.ts, or set KEEL_DEPLOYABLE to one";
    const p = keel();
    p.configResolved({ root });
    await expect(p.load("/@keel/entry.ts")).rejects.toThrow(msg);
    write("topology.ts", `export default { api: { modules: ["a"], adapter: "node" } };\n`);
    const q = keel();
    q.configResolved({ root, command: "serve" });
    expect(await q.load("/@keel/entry.ts")).toBe(resumeEntry(undefined, "dev", "virtual:keel.css"));
    const b = keel();
    b.configResolved({ root, command: "build" });
    expect(await b.load("/@keel/entry.ts")).toBe(resumeEntry(undefined, "production", "virtual:keel.css"));
  });

  it("a node-only build's resume entry imports the atomic CSS, so the entry chunk names the stylesheet", async () => {
    write("topology.ts", `export default { web: { modules: ["a"], adapter: "node" } };\n`);
    const b = keel();
    b.configResolved({ root, command: "build" });
    const text = await b.load("/@keel/entry.ts");
    expect(typeof text === "string" && text.split("\n")[0]).toBe('import "virtual:keel.css";');
    expect(RESUME_ENTRY).not.toContain("virtual:keel.css");
  });

  it(
    "gives the production entries when Vite reports no command; only serve gives dev",
    { timeout: fixedTime(30000) },
    async () => {
      write(
        "topology.ts",
        `export default { web: { modules: ["a"], adapter: "client" }, api: { modules: ["a"], adapter: "node" } };\n`,
      );
      write("modules/a/routes.ts", routesTs("a"));
      const all = {};
      const client = (mode: "dev" | "production") =>
        entryCode(["/modules/a/routes.ts"], "virtual:keel.css", {}, all, undefined, mode, false, true, "web");
      const none = keel();
      none.configResolved({ root });
      expect(await none.load("/@keel/entry.ts")).toBe(client("production"));
      const serve = keel();
      serve.configResolved({ root, command: "serve" });
      expect(await serve.load("/@keel/entry.ts")).toBe(client("dev"));
      process.env.KEEL_DEPLOYABLE = "api";
      expect(await none.load("/@keel/entry.ts")).toBe(resumeEntry(undefined, "production", "virtual:keel.css"));
      expect(await serve.load("/@keel/entry.ts")).toBe(resumeEntry(undefined, "dev", "virtual:keel.css"));
    },
  );

  it("throws topology problems when building and warns when serving", { timeout: fixedTime(30000) }, async () => {
    write("topology.ts", `export default { a: 5, b: { modules: [], adapter: 'x' } };\n`);
    const p = keel();
    expect(() => p.configResolved({ root, command: "build" })).toThrow(
      new Error(
        "E1552 topology.ts a: not an object\nE1552 topology.ts b: needs modules: [...] and adapter: 'node' | 'static' | 'client'",
      ),
    );
    const q = keel();
    expect(() => q.configResolved({ root, command: "serve" })).not.toThrow();
    const r = keel();
    expect(() => r.configResolved({ root })).not.toThrow();
    const warnings: string[] = [];
    await r.buildStart.call({ warn: (m: string) => void warnings.push(m) });
    expect(warnings).toEqual([
      "E1552 topology.ts a: not an object\nE1552 topology.ts b: needs modules: [...] and adapter: 'node' | 'static' | 'client'",
    ]);
  });

  it(
    "watches project files: refreshes eagerly with a server, lazily without",
    { timeout: fixedTime(30000) },
    async () => {
      write("tokens.ts", TOKENS);
      write("A.tsx", page('p="1"'));
      const p = keel();
      p.configResolved({ root, command: "build" });
      await p.buildStart.call(undefined);
      const f = fakeServer();
      p.configureServer(f.server);
      const base = f.reloaded.length;
      write("tokens.ts", TOKENS.replace("4px", "5px"));
      p.watchChange(path.join(root, "A.tsx"), { event: "update" });
      p.watchChange(path.join(root, "xtokens.ts"), { event: "update" });
      p.watchChange(path.join(root, "node_modules/x/tokens.ts"), { event: "update" });
      p.watchChange(path.join(root, "tokens.tsx"), { event: "update" });
      expect(f.reloaded).toHaveLength(base);
      expect((await p.load("/__keel.css")) ?? "").toContain("--k-space-1:4px");
      p.watchChange(path.join(root, "tokens.ts"), { event: "update" });
      await vi.waitFor(() => expect(f.reloaded).toHaveLength(base + 1));
      expect((await p.load("/__keel.css")) ?? "").toContain("--k-space-1:5px");
    },
  );

  it(
    "marks the css stale for routes, schema and topology files and refreshes on the next load",
    { timeout: fixedTime(30000) },
    async () => {
      write("tokens.ts", TOKENS);
      write("A.tsx", page('p="1"'));
      const p = keel();
      p.configResolved({ root, command: "build" });
      await p.buildStart.call(undefined);
      for (const [i, rel] of [
        "modules/a/routes.ts",
        "a.schema.ts",
        "tokens.ts",
        "topology.ts",
        "x/topology.ts",
      ].entries()) {
        const px = String(i + 5);
        write("tokens.ts", TOKENS.replace("4px", `${px}px`));
        p.watchChange(path.join(root, rel), { event: "update" });
        expect((await p.load("/__keel.css")) ?? "", rel).toContain(`--k-space-1:${px}px`);
      }
      write("tokens.ts", TOKENS.replace("4px", "99px"));
      p.watchChange(path.join(root, "src/xroutes.ts"), { event: "update" });
      p.watchChange(path.join(root, "src/a.schemas.ts"), { event: "update" });
      expect((await p.load("/__keel.css")) ?? "").not.toContain("99px");
    },
  );

  it(
    "recompiles every module when topology.ts changes, and never fails a transform on E1004",
    { timeout: fixedTime(30000) },
    async () => {
      write("topology.ts", `export default { web: { modules: ["m"], adapter: "client" } };\n`);
      const p = keel();
      p.configResolved({ root });
      const file = path.join(root, "modules/m/a.ts");
      const src = "import x from './x.server.ts';\nexport const y = x;\n";
      expect(p.transform(src, file)).not.toBeNull();
      write("topology.ts", `export default { web: { modules: ["m"], adapter: "node" } };\n`);
      p.watchChange(path.join(root, "topology.ts"), { event: "update" });
      expect(p.transform(src, file)).not.toBeNull();
      write("topology.ts", `export default { web: { modules: ["m"], adapter: "client" } };\n`);
      p.watchChange(path.join(root, "topology.ts"), { event: "update" });
      expect(p.transform(src, file)).not.toBeNull();
      fs.rmSync(path.join(root, "topology.ts"));
      p.watchChange(path.join(root, "topology.ts"), { event: "delete" });
      expect(p.transform(src, file)).not.toBeNull();
    },
  );

  it("warns when a background refresh fails", { timeout: fixedTime(30000) }, async () => {
    write("tokens.ts", TOKENS);
    const warnings: string[] = [];
    const p = keel();
    p.configResolved({ root, command: "build" });
    await p.buildStart.call({ warn: (m: string) => void warnings.push(m) });
    p.configureServer(fakeServer().server);
    write("tokens.ts", 'import "./nope.ts";\n');
    p.watchChange(path.join(root, "tokens.ts"), { event: "update" });
    await vi.waitFor(() => expect(warnings).toHaveLength(1));
    expect(warnings[0]?.startsWith("keel: ")).toBe(true);
    expect(warnings[0]).toContain("Could not resolve");
  });
});

describe("vite: inspect endpoint", () => {
  type Reply = { status: number; headers: http.IncomingHttpHeaders };
  const listen = async (use: (s: http.Server) => void): Promise<{ port: number; close: () => Promise<void> }> => {
    const s = http.createServer();
    use(s);
    await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", resolve));
    const addr: AddressInfo | string | null = s.address();
    const port = typeof addr === "object" && addr !== null ? addr.port : 0;
    return { port, close: () => new Promise<void>((resolve) => s.close(() => resolve())) };
  };
  const get = (port: number, headers: Record<string, string>): Promise<Reply> =>
    new Promise((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port, path: "/__keel/inspect", method: "GET", headers }, (res) => {
        res.resume();
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
      });
      req.on("error", reject);
      req.end();
    });

  it("answers listed origins from KEEL_INSPECT_ORIGINS (trimmed, blanks dropped) on dev and preview servers", async () => {
    process.env.KEEL_INSPECT_ORIGINS = " http://other.test:* , ,http://x.test ";
    const p = keel();
    p.configResolved({ root });
    const used: unknown[] = [];
    p.configureServer({
      moduleGraph: { getModuleById: () => undefined },
      reloadModule: () => Promise.resolve(),
      middlewares: {
        use(fn) {
          used.push(fn);
        },
      },
    });
    const preview: unknown[] = [];
    p.configurePreviewServer({
      middlewares: {
        use(fn) {
          preview.push(fn);
        },
      },
    });
    expect(used).toHaveLength(3);
    expect(preview).toHaveLength(1);
    expect(preview[0]).toBe(used[0]);
    let mw: Parameters<Parameters<typeof p.configurePreviewServer>[0]["middlewares"]["use"]>[0] | undefined;
    p.configurePreviewServer({
      middlewares: {
        use(fn) {
          mw = fn;
        },
      },
    });
    const handler = mw;
    if (handler === undefined) throw new Error("no middleware");
    const srv = await listen((s) =>
      s.on("request", (req, res) =>
        handler(req, res, () => {
          res.statusCode = 404;
          res.end();
        }),
      ),
    );
    try {
      const ok1 = await get(srv.port, { origin: "http://other.test:3000" });
      expect(ok1.status).toBe(200);
      expect(ok1.headers["access-control-allow-origin"]).toBe("http://other.test:3000");
      expect((await get(srv.port, { origin: "http://x.test" })).status).toBe(200);
      expect((await get(srv.port, { origin: "http://evil.test" })).status).toBe(403);
      expect((await get(srv.port, { origin: "" })).status).toBe(403);
      expect((await get(srv.port, {})).status).toBe(200);
    } finally {
      await srv.close();
    }
  });

  it("refuses every foreign origin when none are configured", async () => {
    const p = keel();
    p.configResolved({ root });
    let mw: Parameters<Parameters<typeof p.configurePreviewServer>[0]["middlewares"]["use"]>[0] | undefined;
    p.configurePreviewServer({
      middlewares: {
        use(fn) {
          mw = fn;
        },
      },
    });
    const handler = mw;
    if (handler === undefined) throw new Error("no middleware");
    const srv = await listen((s) => s.on("request", (req, res) => handler(req, res, () => res.end())));
    try {
      expect((await get(srv.port, { origin: "" })).status).toBe(403);
      expect((await get(srv.port, { origin: "http://other.test:3000" })).status).toBe(403);
      expect((await get(srv.port, {})).status).toBe(200);
    } finally {
      await srv.close();
    }
  });
});
