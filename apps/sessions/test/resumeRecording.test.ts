// @vitest-environment happy-dom
// The service's own deployable on the production path, with a fixture page of this test's own: createApp serves the
// page beside the ingest routes, its island resumes in this document with the page's ctx and starts the recorder, a
// click handler throws, the island's root Boundary reports it, and the recorded session is uploaded once and
// accepted by this service's `sessions.ingest`. Seed 1337
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { manifest } from "@keel/router";
import type { Slots } from "@keel/runtime-dom";
import { resume } from "@keel/runtime-dom/ops";
import { createApp } from "@keel/server";
import { Session, record, session } from "@keel/std-sessions";
import { routes as sessions } from "@keel/std-sessions/routes";
import { Box, Button } from "@keel/ui";
import { describe, expect, it } from "vitest";
import topology from "../topology.ts";

/** What the compiler emits around a bound k.ui base element with a literal `id` in a `.tsx` module: its `data-k` stamp. */
const stamped = (n: Node, id: string): Node => {
  if (n instanceof Element && n.hasAttribute("data-k")) n.setAttribute("data-k", id);
  return n;
};

/** The fixture page: in the browser it records with an upload to this origin; its button throws. */
function Drill(_props?: object, _slots?: Slots, ctx?: Ctx): Node {
  if (ctx !== undefined && typeof location !== "undefined")
    record(ctx, { upload: new URL(sessions.routes["sessions.ingest"].path, location.origin) });
  return Box({
    as: "main",
    id: "ops.drill",
    children: () => [
      stamped(
        Button({
          id: "ops.drill.boom",
          children: "Boom",
          onClick: () => {
            throw new Error("drill failed");
          },
        }),
        "ops.drill.boom",
      ),
    ],
  });
}

const routes = manifest({ "ops.drill": { path: "/drill", component: Drill }, ...sessions.routes });

describe("ops resume recording", () => {
  it("records a handler error in a resumed island and uploads it once to this service", async () => {
    const app = await createApp({
      topology,
      routes,
      ctx: createCtx({ mode: "sim", seed: 1337 }),
      deployable: "sessions",
    });
    const res = await app.fetch(new Request(`${location.origin}/drill`, { headers: { accept: "text/html" } }));
    const body = /<body>([\s\S]*)<\/body>/.exec(await res.text())?.[1] ?? "";
    document.body.innerHTML = body.replace(/<script type="module"[^>]*><\/script>/, "");

    const ctx = createCtx({ mode: "sim", seed: 1337 });
    expect(resume(document.body, { "ops.drill": Drill }, { ctx }).warnings).toEqual([]);
    const button = document.getElementById("ops.drill.boom");
    if (button === null) throw new Error("fixture: no server button");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();

    expect(document.querySelector('pre[data-k-error="ops.drill.boom"]')).not.toBeNull();
    const taken = session(ctx).taken();
    expect(taken).toHaveLength(1);
    const [put] = taken;
    if (put === undefined) throw new Error("no upload");
    expect(put.url.pathname).toBe("/sessions");
    expect(put.session.error?.code).toBe("keel.unexpected");
    const posted = await app.fetch(
      new Request(put.url, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(Session.encode(put.session)),
      }),
    );
    expect(posted.status).toBeLessThan(300);
    record(ctx).stop();
    document.body.innerHTML = "";
  });
});
