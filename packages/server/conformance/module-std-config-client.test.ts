// @vitest-environment happy-dom
// Spec: k.module, clause "An island document of `createApp({ std })` carries as `std` in `#k-state` the config of `clientStd` packages for the served deployable's modules, and a resumed route component reading `stdConfig` on a ctx `bindClientStd` bound gets the server's value; other packages and modules, and a `createApp` without `std`, add nothing."
// Seed 1337
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stdArtifact } from "@keel/compiler";
import { bindClientStd } from "@keel/compiler/std/bindClientStd";
import { clientStd } from "@keel/compiler/std/clientStd";
import { stdConfig } from "@keel/compiler/std/stdConfig";
import { createCtx } from "@keel/ctx";
import { manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { resume } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { Box, Button, Text } from "@keel/ui";
import fc from "fast-check";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

/** Client-readable (`clientStd`). */
const PKG = "@keel/std-cfgclient";
/** Server-only: registered, never marked. */
const SERVER = "@keel/std-cfgserveronly";
const Config = s.object({ limit: s.int({ min: 1, max: 100 }), tags: s.array(s.string({ max: 8 })) });
const ServerConfig = s.object({ apiKey: s.string() });
s.register(PKG, Config);
s.register(SERVER, ServerConfig);
clientStd(PKG);

type Cfg = { limit: number; tags: string[] };
type Mod = { id: string; config: Cfg };
type Ctx = ReturnType<typeof createCtx>;
/** The module of another deployable in the same topology. */
const OTHER = "zeta";

let tmp = "";
let n = 0;
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-std-client-"));
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
afterEach(() => {
  document.body.innerHTML = "";
});

const manifestSrc = (id: string, std: Record<string, unknown>): string =>
  `import { module } from '@keel/compiler'\nexport default module(${JSON.stringify({
    id,
    deps: Object.keys(std),
    capabilities: [],
    public: { exports: [] },
    std,
  })})\n`;

/** `std.json` for `mods` (PKG config, plus a server-only secret each), and the other deployable's module `zeta`. */
const artifact = (mods: Mod[]): { file: string; data: unknown } => {
  const files = mods.map((m) => ({
    path: `modules/${m.id}/module.ts`,
    source: manifestSrc(m.id, { [PKG]: m.config, [SERVER]: { apiKey: `sk-${m.id}` } }),
  }));
  files.push({ path: `modules/${OTHER}/module.ts`, source: manifestSrc(OTHER, { [PKG]: { limit: 9, tags: ["z"] } }) });
  const { data, hash } = stdArtifact(files);
  const file = path.join(tmp, `std-${n++}.json`);
  fs.writeFileSync(file, JSON.stringify({ data, hash }));
  return { file, data };
};

const expectedOf = (mods: Mod[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const m of mods) out[m.id] = m.config;
  return out;
};

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const mkCtx = (): Ctx => createCtx({ mode: "sim", seed: 1337 });

type Served = { stateText: string | null; bodyHtml: string; html: string };

function makeComponent(seen: unknown[], island: boolean) {
  return (_props: unknown, ctx: Ctx): Node => {
    const cfg = stdConfig(ctx, PKG, Config);
    seen.push(cfg);
    const text = () => Text({ children: JSON.stringify(cfg) });
    return island
      ? Box({ children: () => [text(), Button({ children: "go", onClick: () => undefined })] })
      : Box({ children: () => text() });
  };
}

/** Serve `component` at `/` from deployable `web` (modules `app` and `ids`); deployable `other` holds `zeta`. */
async function serve(
  component: (p: unknown, c: Ctx) => Node,
  ctx: Ctx,
  ids: readonly string[],
  std?: string,
): Promise<Served> {
  const paths: Record<string, string> = { app: "/", [OTHER]: `/${OTHER}` };
  for (const id of ids) paths[id] = `/${id}`;
  const tables = Object.entries(paths).map(([m, at]) =>
    manifest(contract(m, { [`${m}.page`]: { path: at } }), { [`${m}.page`]: { component } }),
  );
  const app = await createApp({
    topology: topology({
      web: { modules: ["app", ...ids], adapter: "node" },
      other: { modules: [OTHER], adapter: "node" },
    }),
    deployable: "web",
    routes: routeTable(...tables),
    ctx,
    ...(std === undefined ? {} : { std }),
  });
  const res = await app.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }));
  expect(res.status).toBe(200);
  const html = await res.text();
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const stateEl = parsed.getElementById("k-state");
  for (const sc of parsed.body.querySelectorAll("script[type=module]")) sc.remove();
  return { stateText: stateEl?.textContent ?? null, bodyHtml: parsed.body.innerHTML, html };
}

function stateOf(served: Served): Record<string, unknown> {
  if (served.stateText === null) throw new Error("fixture: no #k-state");
  const v: unknown = JSON.parse(served.stateText);
  if (!isRec(v)) throw new Error("fixture: #k-state is not an object");
  return v;
}

const validConfig = fc.record({
  limit: fc.integer({ min: 1, max: 100 }),
  tags: fc.array(fc.string({ maxLength: 8 }), { maxLength: 4 }),
});
const moduleIds = fc.uniqueArray(fc.constantFrom("alpha", "beta", "gamma", "delta"), { minLength: 1, maxLength: 3 });

describe("k.module: std config in an island document", () => {
  const mods: Mod[] = [
    { id: "alpha", config: { limit: 5, tags: ["a", "b"] } },
    { id: "beta", config: { limit: 80, tags: [] } },
  ];
  const ids = mods.map((m) => m.id);

  it("an island document's `#k-state` carries the `clientStd` config of the served modules as `std`, and the resumed component reads the server's value from a ctx `bindClientStd` bound", async () => {
    const { file } = artifact(mods);
    const seen: unknown[] = [];
    const component = makeComponent(seen, true);
    const serverCtx = mkCtx();
    const served = await serve(component, serverCtx, ids, file);
    expect(stateOf(served).std).toEqual({ [PKG]: expectedOf(mods) });

    const serverValue = stdConfig(serverCtx, PKG, Config);
    expect(serverValue).toEqual({ ...expectedOf(mods), [OTHER]: { limit: 9, tags: ["z"] } });
    document.body.innerHTML = served.bodyHtml;

    const clientCtx = mkCtx();
    bindClientStd(clientCtx, served.stateText);
    seen.length = 0;
    const result = resume(document.body, { "app.page": component }, { ctx: clientCtx });
    expect(result.warnings.filter((w) => /E1253/.test(w))).toEqual([]);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toEqual(expectedOf(mods));
  });

  it("a server-only package's config and another deployable's module never appear in the document", async () => {
    const { file } = artifact(mods);
    const served = await serve(makeComponent([], true), mkCtx(), ids, file);
    const std = stateOf(served).std;
    expect(isRec(std) && Object.keys(std)).toEqual([PKG]);
    expect(served.html).not.toContain(SERVER);
    expect(served.html).not.toContain("sk-alpha");
    // The server component may render its own config; the payload the browser binds holds no other deployable's.
    expect(served.stateText).not.toContain(`"${OTHER}"`);
    const clientCtx = mkCtx();
    bindClientStd(clientCtx, served.stateText);
    expect(stdConfig(clientCtx, SERVER, ServerConfig)).toEqual({});
  });

  it("a document from a `createApp` without `std` has no `std`, and `stdConfig` on a ctx given its `#k-state` is `{}`", async () => {
    const served = await serve(makeComponent([], true), mkCtx(), []);
    expect(served.stateText).not.toBeNull();
    expect("std" in stateOf(served)).toBe(false);
    const clientCtx = mkCtx();
    bindClientStd(clientCtx, served.stateText);
    expect(stdConfig(clientCtx, PKG, Config)).toEqual({});
  });

  it("a document with no island has no `std` even with `createApp({ std })`", async () => {
    const { file } = artifact(mods);
    const served = await serve(makeComponent([], false), mkCtx(), ids, file);
    expect("std" in stateOf(served)).toBe(false);
  });

  it("random module ids and valid configs round-trip server, document, `bindClientStd` and `stdConfig` on the client to the manifest literals, with no server-only value", async () => {
    // seed 1337
    await fc.assert(
      fc.asyncProperty(moduleIds, fc.array(validConfig, { minLength: 3, maxLength: 3 }), async (ids, cfgs) => {
        const ms: Mod[] = ids.map((id, i) => ({ id, config: cfgs[i] ?? { limit: 1, tags: [] } }));
        const { file } = artifact(ms);
        const seen: unknown[] = [];
        const component = makeComponent(seen, true);
        const served = await serve(component, mkCtx(), ids, file);
        expect(served.html).not.toContain(SERVER);
        document.body.innerHTML = served.bodyHtml;
        const clientCtx = mkCtx();
        bindClientStd(clientCtx, served.stateText);
        expect(stdConfig(clientCtx, PKG, Config)).toEqual(expectedOf(ms));
        seen.length = 0;
        const result = resume(document.body, { "app.page": component }, { ctx: clientCtx });
        expect(result.warnings.filter((w) => /E1253/.test(w))).toEqual([]);
        expect(seen[seen.length - 1]).toEqual(expectedOf(ms));
        document.body.innerHTML = "";
      }),
      { seed: 1337, numRuns: 15 },
    );
  }, 120_000);
});
