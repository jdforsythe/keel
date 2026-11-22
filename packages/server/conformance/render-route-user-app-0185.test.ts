// @vitest-environment happy-dom
// Spec: k.user, Conformance "With `app`, harnesses on one `ctx` with `user` `'u1'` and `'u2'`: each page's load, submit, service call and stream reach `app` as its `user`, with two callers; page 1's write reaches page 2's open stream."
// Spec: k.user, Testing "Two harnesses over one `app` are two users, jars and callers of one server state."
// Seed: 1337 (no generated input: two fixed users). Pending: RFC 0185 is not built. To un-skip: change `test.skip` to `test` in this file once `renderRoute` with `app` signs the page in as `user`.
// ASSUMPTION: `fire` resolves while an event stream the page opened stays open; the stream is read by a component through `service({ contract }).watch`.
// One case per surface. See render-route-user-support.ts.
import { renderRoute } from "@keel/testing";
import { expect, test } from "vitest";
import { boot, rec, reset, routes } from "./render-route-user-support.ts";

const click = { type: "click" } as const;
async function two() {
  reset();
  const { app, ctx } = await boot();
  const h1 = await renderRoute("u.page", { routes, app, ctx, user: "u1" });
  const h2 = await renderRoute("u.page", { routes, app, ctx, user: "u2" });
  return {
    h1,
    h2,
    done: () => {
      h1.dispose();
      h2.dispose();
    },
  };
}

test.skip("with `app`, harnesses on one `ctx` with `user` 'u1' and 'u2': each page's load reaches `app` as its `user`, with two callers", async () => {
  const { done } = await two();
  try {
    expect(rec.loader.map(([u]) => u)).toEqual(["u1", "u2"]);
    const [c1, c2] = rec.loader.map(([, c]) => c);
    expect(c1).not.toBe("");
    expect(c2).not.toBe("");
    expect(c1).not.toBe(c2);
    expect(rec.identified).toEqual([]);
  } finally {
    done();
  }
});

test.skip("with `app`, each page's submit reaches `app` as its `user`, with its own caller", async () => {
  const { h1, h2, done } = await two();
  try {
    const [c1, c2] = rec.loader.map(([, c]) => c);
    await h1.fire("u.note", { type: "input", value: "a" });
    await h1.fire("u.save", click);
    expect(rec.action).toEqual([["u1", c1]]);
    await h2.fire("u.note", { type: "input", value: "b" });
    await h2.fire("u.save", click);
    expect(rec.action).toEqual([
      ["u1", c1],
      ["u2", c2],
    ]);
    expect(rec.identified).toEqual([]);
  } finally {
    done();
  }
});

test.skip("with `app`, each page's service call reaches `app` as its `user`, with its own caller", async () => {
  const { h1, h2, done } = await two();
  try {
    const [c1, c2] = rec.loader.map(([, c]) => c);
    await h1.fire("u.who", click);
    await h2.fire("u.who", click);
    expect(rec.guard).toEqual([
      ["u1", c1],
      ["u2", c2],
    ]);
    expect(rec.who).toEqual([
      ["u1", c1],
      ["u2", c2],
    ]);
    expect(h1.find("u.out").text).toBe("u1");
    expect(h2.find("u.out").text).toBe("u2");
    expect(rec.identified).toEqual([]);
  } finally {
    done();
  }
});

test.skip("with `app`, each page's event stream reaches `app` as its `user`, with its own caller", async () => {
  const { h1, h2, done } = await two();
  try {
    const [c1, c2] = rec.loader.map(([, c]) => c);
    await h1.fire("u.watch", click);
    await h2.fire("u.watch", click);
    expect(rec.live).toEqual([
      ["u1", c1],
      ["u2", c2],
    ]);
    expect(rec.identified).toEqual([]);
  } finally {
    done();
  }
});

test.skip("with `app`, page 1's write reaches page 2's open stream", async () => {
  const { h1, h2, done } = await two();
  try {
    await h2.fire("u.watch", click);
    expect(h2.find("u.live").text).toBe("u2:0");
    await h1.fire("u.bump", click);
    await h2.settle();
    expect(rec.bump.at(-1)?.[0]).toBe("u1");
    expect(h2.find("u.live").text).toBe("u2:1");
  } finally {
    done();
  }
});
