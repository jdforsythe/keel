// k.user User: a stream whose `user` a verified `x-keel-user` gave answers `currentUser()` with that user and runs no
// `identify`. `x` calls `y`'s live entry through `service({ contract: b })` with `user: 'u1'` on a ctx bound by `x`'s
// `createApp` under the app's secret, so the call is signed.
// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { loader, manifest, routesArtifact } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import { service } from "@keel/services";
import { tempDir } from "@keel/tooling/test-tmp";
import { expect, test } from "vitest";

const SECRET = "test-secret-user-0123456789abcdef0123456789abcdef0123";
const Now = s.object({ user: s.string(), current: s.string() });
const Boom = s.error("a.boom", s.object({}));
const b = contract("b", { "b.live": { method: "GET", path: "/b/live", events: true, output: Now } });
const a = contract("a", { "a.show": { method: "GET", path: "/a/show", output: Now } });

test("a stream opened with a verified `x-keel-user: u1` answers `currentUser()` `'u1'` with no `identify` call", async () => {
  const identifiedY: Request[] = [];
  const ctxX = createCtx({ mode: "sim", seed: 1337 });
  const ctxY = createCtx({ mode: "sim", seed: 1337 });
  const api = service({ contract: b });
  const live = loader(b, "b.live", {}, async function* ({ user, currentUser }) {
    yield ok({ user, current: await currentUser() });
  });
  const show = loader(a, "a.show", {}, async (_args, ctx) => {
    for await (const e of api.live({ user: "u1" }, ctx)) return e.ok ? ok(e.value) : err(Boom.make({}));
    return err(Boom.make({}));
  });
  const t = topology({ x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } });
  const artifacts = tempDir("keel-current-user-");
  const bRoutes = manifest(b, { "b.live": { loader: live } });
  fs.writeFileSync(path.join(artifacts, "routes.json"), JSON.stringify({ data: routesArtifact(bRoutes), hash: "" }));
  const y = await createApp({
    topology: t,
    deployable: "y",
    routes: bRoutes,
    ctx: ctxY,
    mode: "production",
    secret: SECRET,
    identity: identity({
      identify: async ({ request }) => {
        identifiedY.push(request);
        return "";
      },
    }),
  });
  const headers: (string | null)[] = [];
  ctxX.net.route("http://y.test/*", (req) => {
    headers.push(req.headers.get("x-keel-user"));
    return y.fetch(req);
  });
  const x = await createApp({
    topology: t,
    deployable: "x",
    routes: manifest(a, { "a.show": { loader: show } }),
    ctx: ctxX,
    mode: "production",
    secret: SECRET,
    peers: { y: "http://y.test" },
    artifacts,
  });
  const res = await x.fetch(new Request("http://localhost/a/show", { headers: { accept: "application/json" } }));
  expect(JSON.stringify(await res.json())).toContain(JSON.stringify({ user: "u1", current: "u1" }));
  expect(headers).toHaveLength(1);
  expect(headers[0]).not.toBeNull();
  expect(identifiedY).toHaveLength(0);
  fs.rmSync(artifacts, { recursive: true, force: true });
});
