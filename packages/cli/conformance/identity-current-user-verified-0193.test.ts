// Spec: k.user, Conformance "With `identify` answering `'u1'` at open and `''` after, a live loader's `currentUser()` answers `''`, one `identify` call per call; a stream opened with a verified `x-keel-user: u1`, `'u1'` with no `identify` call."
// Seed 1337
// Pending (rfc:0193): skipped until the build lands; the builder un-skips by changing `test.skip` to `test` in this file.
// Assumption: the header's format is not specified, so it is captured from a real `service` call; a split `x`/`y` pair as in identity-peers.test.ts, `y` serving one live entry whose loader answers `currentUser()`. The header is resent to `y` as an event-stream GET of the same method and path.
// @vitest-environment node
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import { service } from "@keel/services";
import { expect, test } from "vitest";

const SECRET = "conformance-secret-user-0123456789abcdef0123456789abcdef";
const Now = s.object({ user: s.string(), current: s.string() });
const b = contract("b", { "b.live": { method: "GET", path: "/b/live", events: true, output: Now } });

test("a stream opened with a verified `x-keel-user: u1` has `currentUser()` answer `'u1'` with no `identify` call", async () => {
  const identified: Request[] = [];
  const ctxY = createCtx({ mode: "sim", seed: 1337 });
  const ctxX = createCtx({ mode: "sim", seed: 1337 });
  const live = Reflect.apply(loader, undefined, [
    b,
    "b.live",
    {},
    async function* (args: { user: string; currentUser: () => Promise<string> }) {
      yield ok({ user: args.user, current: await args.currentUser() });
    },
  ]);
  const t = topology({ x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } });
  const y = await createApp({
    topology: t,
    deployable: "y",
    routes: manifest(b, { "b.live": { loader: live } }),
    ctx: ctxY,
    mode: "production",
    secret: SECRET,
    identity: identity({
      identify: async ({ request }) => {
        identified.push(request);
        return "";
      },
    }),
  });
  let header: string | null = null;
  ctxX.net.route("http://y.test/*", (req) => {
    header = req.headers.get("x-keel-user");
    return y.fetch(req);
  });
  const api = service({ contract: b });
  void api.live({ user: "u1" }, ctxX);
  for (let i = 0; i < 50; i++) await Promise.resolve();
  expect(header).not.toBeNull();
  identified.length = 0;
  const res = await y.fetch(
    new Request("http://localhost/b/live", {
      headers: { accept: "text/event-stream", "x-keel-user": header ?? "" },
    }),
  );
  const reader = res.body?.getReader();
  const chunk = await reader?.read();
  expect(new TextDecoder().decode(chunk?.value)).toContain('"current":"u1"');
  expect(identified).toHaveLength(0);
  await reader?.cancel();
});
