// @vitest-environment happy-dom
// Spec: k.module, clause "With `clientStd(pkg, ['a'])`, `#k-state` holds only key `a` of each module's `pkg` config." (rfc:0070)
// Seed 1337
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stdArtifact } from "@keel/compiler";
import { bindClientStd } from "@keel/compiler/std/bindClientStd";
import { clientStd } from "@keel/compiler/std/clientStd";
import { stdConfig } from "@keel/compiler/std/stdConfig";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { Box, Button, Text } from "@keel/ui";
import fc from "fast-check";
import { afterAll, beforeAll, expect, test } from "vitest";

const PKG = "@keel/std-cfgclientkeys";
const Config = s.object({ redact: s.array(s.string()), readers: s.array(s.string()).optional() });
s.register(PKG, Config);
clientStd(PKG, ["redact"]);

type Ctx = ReturnType<typeof createCtx>;
const mkCtx = (): Ctx => createCtx({ mode: "sim", seed: 1337 });
let tmp = "";
let n = 0;
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-std-keys-"));
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const manifestSrc = (id: string, cfg: unknown): string =>
  `import { module } from '@keel/compiler'\nexport default module(${JSON.stringify({
    id,
    deps: [PKG],
    capabilities: [],
    public: { exports: [] },
    std: { [PKG]: cfg },
  })})\n`;

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

async function served(
  redact: string[],
  readers: string[],
): Promise<{ state: Record<string, unknown>; html: string; server: unknown }> {
  const { data, hash } = stdArtifact([
    { path: "modules/app/module.ts", source: manifestSrc("app", { redact, readers }) },
  ]);
  const file = path.join(tmp, `std-${n++}.json`);
  fs.writeFileSync(file, JSON.stringify({ data, hash }));
  const component = (_p: unknown, ctx: Ctx): Node =>
    Box({
      children: () => [
        Text({ children: String(stdConfig(ctx, PKG, Config).app?.redact.length ?? 0) }),
        Button({ children: "go", onClick: () => undefined }),
      ],
    });
  const ctx = mkCtx();
  const appContract = contract("app", { "app.page": { path: "/" } });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(appContract, { "app.page": { component: component } }),
    ctx,
    std: file,
  });
  const res = await app.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }));
  const html = await res.text();
  const text = new DOMParser().parseFromString(html, "text/html").getElementById("k-state")?.textContent ?? "{}";
  const state: unknown = JSON.parse(text);
  if (!isRec(state)) throw new Error("fixture: #k-state is not an object");
  const client = mkCtx();
  bindClientStd(client, text);
  return { state, html, server: stdConfig(ctx, PKG, Config).app };
}

test("#k-state holds only the named keys of each module's config; the server still reads every key", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.stringMatching(/^tx:cart\.[a-z]{1,6}#[a-z]{1,6}$/), { maxLength: 3 }),
      fc.array(fc.stringMatching(/^R[A-Za-z0-9]{12}$/), { minLength: 1, maxLength: 3 }),
      async (redact, readers) => {
        const { state, html, server } = await served(redact, readers);
        expect(state.std).toEqual({ [PKG]: { app: { redact } } });
        for (const r of readers) expect(html).not.toContain(r);
        expect(server).toEqual({ redact, readers });
      },
    ),
    { seed: 1337, numRuns: 10 },
  );
});
