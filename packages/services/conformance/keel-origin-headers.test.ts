// @vitest-environment happy-dom
// Spec: k.services, clause "The same `base` client with `base` the document's origin in a browser, a `keel-peer` origin, or a URL peer of the `createApp` that bound `ctx` (the app's own `node` deployable) sends `x-keel: 1` besides; every `service({ contract })` request carries `x-keel: 1`, in process too."
// k.services, Encoding "to a Keel origin it also carries `x-keel: 1` (k.server's same-site proof)"
// Seed: 1337. Observed on the sim net, except the in-process case, which is observed at the app's `identify` (it is handed the request).
// Live: the pre-RFC client already sends `x-keel: 1` everywhere, so the Keel-origin cases pass before and after the build.
// Pending: the `keel-peer` case needs the built client entry, which binds the document's `keel-peer` tags to its `ctx` (k.hosting Peers; packages/cli/conformance/hosting-peer-binding.test.ts builds one). To un-skip: run it in that build rig, or change `test.skip` to `test` once a `ctx` bound by tags is constructible from the public API.
// ASSUMPTION: `createApp({ topology, routes, ctx, deployable, peers: { y: URL }, artifacts })` binds `ctx`; `artifacts` is a directory with `routes.json` `{ data: routesArtifact(routes), hash: "" }` (as packages/cli/conformance/topology-modules.ts writes it).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { loader, manifest, routesArtifact } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import * as server from "@keel/server";
import { identity, topology } from "@keel/server";
import { service } from "@keel/services";
import fc from "fast-check";
import { beforeEach, describe, expect, test } from "vitest";
import { SEED, THIRD, client, drain, json, record, simCtx } from "./third-party-support.ts";

function setDocumentUrl(url: string): void {
  const h: unknown = Reflect.get(window, "happyDOM");
  const set: unknown = typeof h === "object" && h !== null ? Reflect.get(h, "setURL") : undefined;
  if (typeof set !== "function") throw new Error("fixture: no happyDOM.setURL");
  Reflect.apply(set, h, [url]);
}
beforeEach(() => setDocumentUrl("https://app.test/"));

const DOC = "https://app.test";
const PEER = "http://y.test";
const idArb = fc.stringMatching(/^[a-z0-9]{1,12}$/);

const b = contract("b", { "b.get": { method: "GET", path: "/b", output: s.object({ n: s.int() }) } });
const bRoutes = manifest(b, { "b.get": { loader: loader(b, "b.get", {}, async () => ok({ n: 1 })) } });
const bClient = service({ contract: b });

/** Calls createApp loosely: the options are partly beyond what index.ts types. */
async function boundApp(o: Record<string, unknown>): Promise<void> {
  const make: unknown = Reflect.get(server, "createApp");
  if (typeof make !== "function") throw new Error("@keel/server does not export createApp");
  await Reflect.apply(make, undefined, [o]);
}
function artifacts(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-artifacts-"));
  fs.writeFileSync(path.join(dir, "routes.json"), JSON.stringify({ data: routesArtifact(bRoutes), hash: "" }));
  return dir;
}

async function bindToPeer(ctx: SimCtx): Promise<void> {
  await boundApp({
    topology: topology({ x: { modules: ["x"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } }),
    deployable: "x",
    routes: manifest(contract("x", {}), {}),
    ctx,
    peers: { y: PEER },
    artifacts: artifacts(),
  });
}

describe("k.services: a request to a Keel origin carries `x-keel: 1`", () => {
  test("a `base` client pointed at the document's origin in a browser sends `x-keel: 1` besides", async () => {
    await fc.assert(
      fc.asyncProperty(idArb, async (id) => {
        const ctx = simCtx();
        const sent = record(ctx);
        await client(DOC).show({ params: { id } }, ctx);
        await client(DOC).save({ params: { id }, body: { note: "n" } }, ctx);
        await drain(client(DOC).watch({}, ctx));
        expect(sent).toHaveLength(3);
        for (const r of sent) expect(r.headers["x-keel"]).toBe("1");
        expect(sent[0]?.headers.accept).toBe("application/json");
        expect(sent[2]?.headers.accept).toBe("text/event-stream");
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("a `base` client pointed at a `keel-peer` origin sends `x-keel: 1` besides", async () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "keel-peer");
    meta.setAttribute("data-deployable", "api");
    meta.setAttribute("content", "https://peer.test");
    document.head.append(meta);
    // ctx here must be the one the client entry bound to those tags; a bare sim ctx cannot be (see the header).
    const ctx = simCtx();
    const sent = record(ctx);
    await client("https://peer.test").show({ params: { id: "1" } }, ctx);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.headers["x-keel"]).toBe("1");
  });

  test("a `base` client pointed at a URL peer of the `createApp` that bound `ctx` sends `x-keel: 1` besides", async () => {
    const ctx = simCtx();
    await bindToPeer(ctx);
    const sent = record(ctx, () => json(null));
    await client(PEER).show({ params: { id: "1" } }, ctx);
    await client(PEER).save({ params: { id: "1" }, body: { note: "n" } }, ctx);
    expect(sent).toHaveLength(2);
    for (const r of sent) expect(r.headers["x-keel"]).toBe("1");
  });

  test("a `base` client pointed at another origin from the ctx a `createApp` bound sends no `x-keel`", async () => {
    // Pending the build of RFC 0197; to un-skip, change `test.skip` to `test`.
    const ctx = simCtx();
    await bindToPeer(ctx);
    const sent = record(ctx, () => json(null));
    await client(THIRD).show({ params: { id: "1" } }, ctx);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.names).not.toContain("x-keel");
  });

  test("every `service({ contract })` request carries `x-keel: 1`: on a ctx no `createApp` bound", async () => {
    // the happy-dom document is `https://app.test`, so the target is the document's origin; either way it is a Keel origin
    const ctx = simCtx();
    const sent = record(ctx, () => json({ id: "b.get", results: { "b.get": { ok: true, value: { n: 1 } } } }));
    await bClient.get({}, ctx);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.headers["x-keel"]).toBe("1");
  });

  test("every `service({ contract })` request carries `x-keel: 1`, in process too", async () => {
    const seenByIdentify: (string | null)[] = [];
    const ctx = createCtx({ mode: "sim", seed: SEED });
    await boundApp({
      topology: topology({ web: { modules: ["b"], adapter: "node" } }),
      routes: bRoutes,
      ctx,
      mode: "production",
      identity: identity({
        identify: async ({ request }) => {
          seenByIdentify.push(request.headers.get("x-keel"));
          return "";
        },
      }),
    });
    const sent = record(ctx);
    const r = await bClient.get({}, ctx);
    expect(r.ok).toBe(true);
    expect(sent).toEqual([]); // in process: no fetch
    expect(seenByIdentify).toEqual(["1"]);
  });
});
