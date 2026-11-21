// @vitest-environment happy-dom
// The production path: a route is server-rendered by createApp, its island resumes in this document with the page's
// ctx, the island starts the recorder, and a click handler throws. The island's root Boundary reports the error, the
// recorder records it, and the session is uploaded once. Seed 1337
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { resume } from "@keel/runtime-dom/ops";
import { createApp, topology } from "@keel/server";
import { Box, Button } from "@keel/ui";
import { afterEach, describe, expect, test } from "vitest";
import { record, session } from "../src/index.ts";
import { stamped } from "./stamped.ts";

/** A page whose button throws; in the browser it records the session with an upload to this origin. */
function Shop(_props: object, ctx: Ctx): Node {
  if (typeof location !== "undefined") record(ctx, { upload: new URL("/sessions", location.origin) });
  return Box({
    as: "main",
    id: "shop.page",
    children: () => [
      stamped(
        Button({
          id: "shop.boom",
          children: "Buy",
          onClick: () => {
            throw new Error("checkout failed");
          },
        }),
        "shop.boom",
      ),
    ],
  });
}

async function serve(): Promise<void> {
  const app = await createApp({
    topology: topology({ web: { modules: ["shop"], adapter: "node" } }),
    routes: manifest(contract("shop", { "shop.page": { path: "/" } }), { "shop.page": { component: Shop } }),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
  });
  const res = await app.fetch(new Request("http://localhost:3000/", { headers: { accept: "text/html" } }));
  const body = /<body>([\s\S]*)<\/body>/.exec(await res.text())?.[1] ?? "";
  document.body.innerHTML = body.replace(/<script type="module"[^>]*><\/script>/, "");
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("resumed island recording", () => {
  test("a handler that throws in a resumed island is recorded and uploaded once", async () => {
    await serve();
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    expect(resume(document.body, { "shop.page": Shop }, { ctx, mode: "dev" }).warnings).toEqual([]);
    const button = document.getElementById("shop.boom");
    if (button === null) throw new Error("fixture: no server button");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(document.querySelector('pre[data-k-error="shop.boom"]')?.textContent).toBe("checkout failed");
    const taken = session(ctx).taken();
    expect(taken).toHaveLength(1);
    expect(taken[0]?.session.route.id).toBe("shop.page");
    expect(taken[0]?.session.error?.code).toBe("keel.unexpected");
    expect(taken[0]?.session.events.map((e) => e.kind)).toEqual(["fire", "error"]);
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(session(ctx).taken()).toHaveLength(1);
    record(ctx).stop();
  });
});
