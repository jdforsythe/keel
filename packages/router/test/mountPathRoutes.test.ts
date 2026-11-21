// @vitest-environment happy-dom
// A router given `mount` (the identity mount's path) never matches a page at or under it, so a link, `navigate` or an
// action's `ok` there is a document navigation even when a param route of the table would fit it (k.mount
// Navigation). The mount is the router's own: another router in the same process, given none or another, routes as
// its table says. A path holding a `\` matches no page.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { identityMount } from "../src/identityMount.ts";
import { createRouterWith } from "../src/internal/createRouterWith.ts";
import { manifest } from "../src/manifest.ts";
import { memoryHistory } from "./memoryHistory.ts";
import { to } from "./to.ts";

const gate = identityMount("/gate");
const routes = manifest({
  "g.any": {
    path: "/:svc/:act",
    params: s.object({ svc: s.string(), act: s.string() }),
    component: () => document.createElement("main"),
  },
  "g.home": { path: "/", component: () => document.createElement("main") },
});
const start = (mount?: string) => {
  const left: string[] = [];
  const history = memoryHistory("/");
  const router = createRouterWith(routes, {
    ctx: createCtx({ mode: "sim" }),
    history,
    leave: (url) => void left.push(url),
    mount,
  });
  return { router, left, history };
};

describe("a param route that fits the router's mount path", () => {
  it("is not matched there: navigate to the mount is a document navigation, elsewhere stays a page", async () => {
    const { router, left } = start(gate.path);
    await router.navigate(gate.href("/sign-out"));
    await router.navigate(to("/gate/deep/er"));
    await router.navigate(to("/gate"));
    expect(left).toEqual(["/gate/sign-out", "/gate/deep/er", "/gate"]);
    await router.navigate(to("/gatehouse/x"));
    expect(left).toHaveLength(3);
    expect(router.route.get()).toMatchObject({ id: "g.any", params: { svc: "gatehouse", act: "x" } });
  });
});

describe("two routers in one process", () => {
  it("each reads only its own mount: one at /gate leaves, one at /other or with none takes /gate/x as a page", async () => {
    identityMount("/other");
    const at = start(gate.path);
    const other = start("/other");
    const none = start();
    for (const { router } of [at, other, none]) await router.navigate(to("/gate/x"));
    expect(at.left).toEqual(["/gate/x"]);
    expect(other.left).toEqual([]);
    expect(none.left).toEqual([]);
    expect(none.router.route.get()).toMatchObject({ id: "g.any", params: { svc: "gate", act: "x" } });
    await other.router.navigate(to("/other/x"));
    await at.router.navigate(to("/other/x"));
    expect(other.left).toEqual(["/other/x"]);
    expect(at.left).toEqual(["/gate/x"]);
  });
});

describe("a backslash in a path", () => {
  it("matches no page, so a navigation there is a document navigation and no history entry holds it", async () => {
    const { router, left, history } = start();
    await router.navigate(to("/a/\\x"));
    await router.navigate(to("/\\x/y"));
    expect(left).toEqual(["/a/\\x", "/\\x/y"]);
    expect(history.entries.join("")).not.toContain("\\");
  });
});
