// What the server reads from the router (`@keel/router/internal`): a guard run as a caller with or without a bearer
// (k.api Bearer), the params a guard redirect carries (k.guards Carried params), and a table's bindings (k.routes).
import { createCtx } from "@keel/ctx";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { contract } from "../src/contract/contract.ts";
import { guard } from "../src/guard.ts";
import { bindingsOf, carriedParams, compileRoutes, runGuard } from "../src/internal/index.ts";
import { manifest } from "../src/manifest.ts";

const SEED = 1337;
/** A component for a table that renders no page. */
const view = (): Node => {
  throw new Error("no page renders here");
};
const Denied = s.error("keel.denied", s.object({}));

describe("runGuard", () => {
  it("gives the guard the url, the caller and the user, and the bearer only when there is one", async () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const Token = s.secret(s.string());
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("/a", "/api/x?y=1"),
        fc.constantFrom("", "c1"),
        fc.constantFrom("", "u1"),
        fc.option(fc.constantFrom("t0ken", "other"), { nil: undefined }),
        async (url, caller, user, raw) => {
          const seen: unknown[] = [];
          const g = guard({}, async (req, got) => {
            seen.push(req.url, req.caller, req.user, req.bearer, got === ctx);
            return ok(null);
          });
          const parsed = raw === undefined ? undefined : Token.parse(raw);
          const bearer = parsed?.ok === true ? parsed.value : undefined;
          const answer =
            bearer === undefined
              ? await runGuard(g, url, ctx, { caller, user })
              : await runGuard(g, url, ctx, { caller, user }, bearer);
          expect(answer).toEqual(ok(null));
          expect(seen).toEqual([url, caller, user, bearer, true]);
          expect(seen[3] === undefined).toBe(raw === undefined);
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });

  it("passes a denial through and turns a throw into an err", async () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const no = guard({}, async () => err(Denied.make({})));
    const boom = guard({}, async () => {
      throw new Error("boom");
    });
    const denied = await runGuard(no, "/a", ctx, { caller: "", user: "" });
    expect(denied.ok).toBe(false);
    expect(denied.ok ? null : denied.error.code).toBe("keel.denied");
    expect((await runGuard(boom, "/a", ctx, { caller: "", user: "" })).ok).toBe(false);
  });
});

describe("carriedParams", () => {
  const Org = s.object({ org: s.string(), team: s.string() });
  const c = contract("cp", {
    "cp.login": { path: "/:org/:team/login", params: Org },
    "cp.plain": { path: "/plain" },
  });
  const table = compileRoutes(manifest(c, { "cp.login": { component: view }, "cp.plain": { component: view } })).table;
  const login = table.get("cp.login")?.def;
  const plain = table.get("cp.plain")?.def;

  it("carries each params field of the redirect route from the matched params, and nothing else", () => {
    expect(carriedParams("cp.login", login, { org: "a", team: "b", extra: "c" })).toEqual(ok({ org: "a", team: "b" }));
    expect(carriedParams("cp.plain", plain, { org: "a" })).toEqual(ok({}));
    expect(carriedParams("cp.none", undefined, { org: "a" })).toEqual(ok({}));
  });

  it("E1508 names the redirect and the first field the matched route lacks or holds as undefined", () => {
    const lacks = (name: string): unknown =>
      err(`E1508 guard redirect to "cp.login" needs param "${name}", which the matched route lacks`);
    expect(carriedParams("cp.login", login, { team: "b" })).toEqual(lacks("org"));
    expect(carriedParams("cp.login", login, { org: "a" })).toEqual(lacks("team"));
    expect(carriedParams("cp.login", login, { org: "a", team: undefined })).toEqual(lacks("team"));
    expect(carriedParams("cp.login", login, { org: undefined, team: "b" })).toEqual(lacks("org"));
    expect(carriedParams("cp.login", login, {})).toEqual(lacks("org"));
    expect(carriedParams("cp.login", login, Object.create({ org: "a", team: "b" }))).toEqual(lacks("org"));
  });
});

describe("bindingsOf", () => {
  it("gives each id its contract, its entry and its binding as written", () => {
    const c = contract("bo", { "bo.page": { path: "/bo" } });
    const binding = { component: view };
    const got = bindingsOf(manifest(c, { "bo.page": binding }));
    expect([...got.keys()]).toEqual(["bo.page"]);
    expect(got.get("bo.page")?.contract).toBe(c);
    expect(got.get("bo.page")?.entry).toBe(c.entries["bo.page"]);
    expect(got.get("bo.page")?.binding).toEqual(binding);
  });

  it("a TypeError for a value that is no route table", () => {
    for (const v of [null, {}, { kind: "keel.routeTable", contracts: [] }]) {
      const thrown = (() => {
        try {
          Reflect.apply(bindingsOf, undefined, [v]);
        } catch (e) {
          return e;
        }
        return null;
      })();
      expect(thrown).toBeInstanceOf(TypeError);
      expect(thrown instanceof Error ? thrown.message : "").toBe(
        "not a route table: pass a manifest(...) or routeTable(...) value",
      );
    }
  });
});
