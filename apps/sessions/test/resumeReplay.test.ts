// @vitest-environment happy-dom
// A session recorded on the resume path replays to the same fingerprint: the home page is served by createApp,
// resumed in this document with the page's ctx (which starts the recorder), and a click whose handler write makes a
// binding's computed throw is uploaded; `replay` of that uploaded session (mount through the harness) reproduces it
// with the same `data.at`, so the fingerprints agree (k.errors: the same throw reports the same `data.at` under
// `mount` and after `resume`). The same holds for a page component's own `effect` that a click makes throw: it is at no
// element of its own, so both paths report the stamp at the root's place. Seed 1337
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { computed, effect, signal } from "@keel/reactive";
import { manifest } from "@keel/router";
import type { Slots } from "@keel/runtime-dom";
import { resume } from "@keel/runtime-dom/ops";
import { createApp } from "@keel/server";
import type { Session } from "@keel/std-sessions";
import { record, replay, session } from "@keel/std-sessions";
import { routes as sessions } from "@keel/std-sessions/routes";
import { Box, Button } from "@keel/ui";
import { describe, expect, it } from "vitest";
import Home from "../modules/ops/Home.ts";
import { routes } from "../modules/ops/routes.ts";
import topology from "../topology.ts";

/** A page whose own effect reads a computed that throws once its button is clicked. */
function Fx(_props?: object, _slots?: Slots, ctx?: Ctx): Node {
  if (ctx !== undefined && typeof location !== "undefined")
    record(ctx, { upload: new URL(sessions.href("sessions.ingest"), location.origin) });
  const open = signal(false);
  const width = computed(() => (open.get() ? "x".repeat(-1).length : 0));
  effect(() => {
    width.get();
  });
  return Box({
    as: "main",
    id: "ops.fx",
    children: () => [Button({ id: "ops.fx.go", children: "Go", onClick: () => open.set(true) })],
  });
}
const fxRoutes = manifest({ "ops.fx": { path: "/fx", component: Fx }, ...sessions.routes });

/** Serve `path` with createApp, resume its island under the page's ctx, click `button`; the uploaded session. */
async function recordedAfterResume(
  appRoutes: typeof routes | typeof fxRoutes,
  path: string,
  island: string,
  component: typeof Home,
  button: string,
): Promise<Session> {
  const app = await createApp({
    topology,
    routes: appRoutes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    deployable: "sessions",
  });
  const res = await app.fetch(new Request(`${location.origin}${path}`, { headers: { accept: "text/html" } }));
  const body = /<body>([\s\S]*)<\/body>/.exec(await res.text())?.[1] ?? "";
  document.body.innerHTML = body.replace(/<script type="module"[^>]*><\/script>/, "");
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  expect(resume(document.body, { [island]: component }, { ctx }).warnings).toEqual([]);
  const el = document.getElementById(button);
  if (el === null) throw new Error(`fixture: no server ${button}`);
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await Promise.resolve();
  const [put] = session(ctx).taken();
  if (put === undefined) throw new Error("no upload");
  record(ctx).stop();
  document.body.innerHTML = "";
  return put.session;
}

describe("ops.home resume recording replays", () => {
  it("replays a session recorded after resume to the same fingerprint", async () => {
    const recorded = await recordedAfterResume(routes, "/", "ops.home", Home, "ops.home.limits");
    expect(recorded.error?.code).toBe("keel.unexpected");
    const out = await replay(recorded, { routes });
    expect(out.error?.code).toBe(recorded.error?.code);
    expect(out.error?.data).toEqual(recorded.error?.data);
    expect(out.reproduced).toBe(true);
  });

  it("replays a page component's own effect throw recorded after resume to the same fingerprint", async () => {
    const recorded = await recordedAfterResume(fxRoutes, "/fx", "ops.fx", Fx, "ops.fx.go");
    expect(recorded.error?.code).toBe("keel.unexpected");
    expect(recorded.error?.data).toEqual({ at: "" });
    const out = await replay(recorded, { routes: fxRoutes });
    expect(out.error?.data).toEqual(recorded.error?.data);
    expect(out.reproduced).toBe(true);
  });
});
