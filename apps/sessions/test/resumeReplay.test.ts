// @vitest-environment happy-dom
// A session recorded on the resume path replays to the same fingerprint: the home page is served by createApp,
// resumed in this document with the page's ctx (which starts the recorder), and a click whose handler write makes a
// binding's computed throw is uploaded; `replay` of that uploaded session (mount through the harness) reproduces it
// with the same `data.at`, so the fingerprints agree (k.errors: the same throw reports the same `data.at` under
// `mount` and after `resume`). Seed 1337
import { createCtx } from "@keel/ctx";
import { resume } from "@keel/runtime-dom/ops";
import { createApp } from "@keel/server";
import { replay, session } from "@keel/std-sessions";
import { describe, expect, it } from "vitest";
import Home from "../modules/ops/Home.ts";
import { routes } from "../modules/ops/routes.ts";
import topology from "../topology.ts";

describe("ops.home resume recording replays", () => {
  it("replays a session recorded after resume to the same fingerprint", async () => {
    const app = await createApp({
      topology,
      routes,
      ctx: createCtx({ mode: "sim", seed: 1337 }),
      deployable: "sessions",
    });
    const res = await app.fetch(new Request(`${location.origin}/`, { headers: { accept: "text/html" } }));
    const body = /<body>([\s\S]*)<\/body>/.exec(await res.text())?.[1] ?? "";
    document.body.innerHTML = body.replace(/<script type="module"[^>]*><\/script>/, "");

    const ctx = createCtx({ mode: "sim", seed: 1337 });
    expect(resume(document.body, { "ops.home": Home }, { ctx }).warnings).toEqual([]);
    const button = document.getElementById("ops.home.limits");
    if (button === null) throw new Error("fixture: no server button");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();

    const [put] = session(ctx).taken();
    if (put === undefined) throw new Error("no upload");
    const recorded = put.session;
    expect(recorded.error?.code).toBe("keel.unexpected");
    document.body.innerHTML = "";

    const out = await replay(recorded, { routes });
    expect(out.error?.code).toBe(recorded.error?.code);
    expect(out.error?.data).toEqual(recorded.error?.data);
    expect(out.reproduced).toBe(true);
  });
});
