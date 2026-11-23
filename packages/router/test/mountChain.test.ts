// @vitest-environment happy-dom
// k.links Return links, k.return: which URLs the intake reads as a return link, the one request a declared link
// sends, which answers are redirects, and where a redirect's location goes: a mount request, the external browser,
// or nowhere. Seed 1337 for the properties.
import { type SimCtx, createCtx } from "@keel/ctx";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { identityMount } from "../src/identityMount.ts";
import { mountRequests } from "../src/internal/mountRequests.ts";
import { personActs } from "../src/internal/personActs.ts";

const SEED = 1337;
const mc = identityMount("/mc", { links: ["/back"] });
const ID = "dev.keel.mc";
const KEY = "keel.return";
const settle = async (): Promise<void> => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const to = (status: number, location: string): Response => new Response(null, { status, headers: { location } });

/** A shell's intake on a fresh ctx whose net answers each path with `answer`; what it sent, opened and closed. */
function shell(answer: (path: string, n: number) => Response) {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: SEED });
  const sent: Request[] = [];
  const opened: string[] = [];
  let closed = 0;
  ctx.net.route("*", async (req) => {
    sent.push(req);
    const u = new URL(req.url);
    return answer(`${u.pathname}${u.search}`, sent.length);
  });
  const inputs = mountRequests(ctx, {
    id: ID,
    open: (u) => void opened.push(u),
    close: () => {
      closed += 1;
    },
    mounts: [mc],
  });
  const paths = (): string[] => sent.map((r) => `${new URL(r.url).pathname}${new URL(r.url).search}`);
  return { ctx, sent, opened, paths, closed: () => closed, ...inputs };
}

describe("the intake of return links", () => {
  it("reads <id>:/<path> with the scheme in any case, and sends a declared link's request", async () => {
    for (const url of [`${ID}:/mc/back`, `${ID.toUpperCase()}:/mc/back`, "Dev.Keel.MC:/mc/back"]) {
      const t = shell(() => new Response(null, { status: 204 }));
      await t.link(url);
      await settle();
      expect(t.paths(), url).toEqual(["/mc/back"]);
    }
    const t = shell(() => new Response(null, { status: 204 }));
    await t.link(`${ID}:/mc/back?code=a%20b&x=1#frag`);
    await settle();
    expect(t.paths()).toEqual(["/mc/back?code=a%20b&x=1"]);
  });

  it("ignores any other URL: another scheme, no leading slash, a path that names a host", async () => {
    const others = [
      "dev.keel.mx:/mc/back",
      "xxxxxxxxxxxx/mc/back",
      `${ID}:mc/back`,
      `${ID}:`,
      `${ID}`,
      "",
      "https://localhost/mc/back",
      "http://localhost/mc/back",
      `${ID}://mc/back`,
      `${ID}://evil.example/mc/back`,
      `${ID}:/\\evil.example/mc/back`,
      `x${ID}:/mc/back`,
    ];
    for (const url of others) {
      const t = shell(() => new Response(null, { status: 204 }));
      await t.link(url);
      await settle();
      expect([t.paths(), t.opened, t.closed(), personActs.of(t.ctx).linked], url).toEqual([[], [], 0, false]);
    }
  });

  it("sends one GET with x-keel, asking for JSON, and follows no redirect itself", async () => {
    const t = shell(() => new Response(null, { status: 204 }));
    await t.link(`${ID}:/mc/back`);
    await settle();
    expect(t.sent).toHaveLength(1);
    const [req] = t.sent;
    expect(req?.url).toBe(new URL("/mc/back", document.baseURI).href);
    expect(req?.method).toBe("GET");
    expect(req?.headers.get("x-keel")).toBe("1");
    expect(req?.headers.get("accept")).toBe("application/json");
    expect(req?.headers.get("content-type")).toBeNull();
    expect(req?.redirect).toBe("manual");
    expect(personActs.of(t.ctx).linked).toBe(true);
  });

  it("a link's GET answered without a redirect opens its URL in the browser and records no opening", async () => {
    const t = shell(() => new Response(null, { status: 200 }));
    await t.link(`${ID}:/mc/back?x=1`);
    await settle();
    expect(t.opened).toEqual(["/mc/back?x=1"]);
    expect(await t.ctx.storage.get(KEY)).toBeNull();
    expect(t.closed()).toBe(0);
  });

  it("fired marks a person's act on the shell's ctx", () => {
    const t = shell(() => new Response(null, { status: 204 }));
    expect(personActs.of(t.ctx).acted).toBe(false);
    t.fired({ type: "focus" });
    expect(personActs.of(t.ctx).acted).toBe(false);
    t.fired({ type: "click" });
    expect(personActs.of(t.ctx).acted).toBe(true);
  });
});

describe("a mount request's answer", () => {
  it("is a redirect exactly for a status from 300 to 399 with a location", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(200, 201, 204, 299, 300, 301, 302, 303, 307, 308, 399, 400, 401, 404, 500),
        async (status) => {
          const t = shell((path) =>
            path === "/mc/back" ? to(status, "/mc/next") : new Response(null, { status: 204 }),
          );
          await t.link(`${ID}:/mc/back`);
          await settle();
          const redirect = status >= 300 && status < 400;
          expect(t.paths()).toEqual(redirect ? ["/mc/back", "/mc/next"] : ["/mc/back"]);
          expect(t.opened).toEqual(redirect ? ["/mc/next"] : ["/mc/back"]);
        },
      ),
      { seed: SEED, numRuns: 60 },
    );
  });

  it("a redirect without a location is no redirect", async () => {
    const t = shell(() => new Response(null, { status: 302 }));
    await t.link(`${ID}:/mc/back`);
    await settle();
    expect([t.paths(), t.opened]).toEqual([["/mc/back"], ["/mc/back"]]);
  });

  it("follows redirects under the mount five in a row, then sends nothing", async () => {
    const t = shell((_path, n) => to(302, `/mc/hop${n}`));
    await t.link(`${ID}:/mc/back`);
    await settle();
    expect(t.paths()).toEqual(["/mc/back", "/mc/hop1", "/mc/hop2", "/mc/hop3", "/mc/hop4", "/mc/hop5"]);
    expect(t.opened).toEqual([]);
  });

  it("a location on another origin opens in the browser when it is http or https, and only then", async () => {
    const elsewhere: readonly (readonly [string, readonly string[]])[] = [
      ["https://provider.example/a?b=1", ["https://provider.example/a?b=1"]],
      ["http://provider.example/a", ["http://provider.example/a"]],
      ["ftp://provider.example/a", []],
      ["mailto:someone@provider.example", []],
      ["javascript:alert(1)", []],
    ];
    for (const [location, opened] of elsewhere) {
      const t = shell(() => to(302, location));
      await t.link(`${ID}:/mc/back`);
      await settle();
      expect([t.paths(), t.opened], location).toEqual([["/mc/back"], opened]);
      expect(await t.ctx.storage.get(KEY)).toBeNull();
    }
  });

  it("a location on the origin outside the mount opens in the browser; one that names a host is ignored", async () => {
    const t = shell(() => to(303, "/elsewhere?x=1#h"));
    await t.link(`${ID}:/mc/back`);
    await settle();
    expect([t.paths(), t.opened]).toEqual([["/mc/back"], ["/elsewhere?x=1#h"]]);
    for (const location of ["//evil.example/mc/x", "/\\evil.example/mc/x", "/.//evil.example/mc/x"]) {
      const u = shell(() => to(302, location));
      await u.link(`${ID}:/mc/back`);
      await settle();
      expect([u.paths(), u.opened], location).toEqual([["/mc/back"], []]);
    }
  });

  it("a location on the shell's own scheme is read as a return link and continues the chain", async () => {
    const t = shell((path) =>
      path === "/mc/back" ? to(302, `${ID}:/mc/again?x=1`) : new Response(null, { status: 204 }),
    );
    await t.link(`${ID}:/mc/back`);
    await settle();
    expect(t.paths()).toEqual(["/mc/back", "/mc/again?x=1"]);
    expect(t.opened).toEqual(["/mc/again?x=1"]);
    const out = shell(() => to(302, `${ID}:/outside`));
    await out.link(`${ID}:/mc/back`);
    await settle();
    expect([out.paths(), out.opened]).toEqual([["/mc/back"], []]);
    const bad = shell(() => to(302, `${ID}:no-slash`));
    await bad.link(`${ID}:/mc/back`);
    await settle();
    expect([bad.paths(), bad.opened]).toEqual([["/mc/back"], []]);
  });

  it("a request that fails changes nothing", async () => {
    const t = shell(() => {
      throw new TypeError("offline");
    });
    await t.link(`${ID}:/mc/back`);
    await settle();
    expect([t.paths(), t.opened, t.closed()]).toEqual([["/mc/back"], [], 0]);
  });
});

describe("a link under the mount that is not declared", () => {
  it("takes the pending opening, closes the browser and sends its request; with none pending it is ignored", async () => {
    const none = shell(() => new Response(null, { status: 204 }));
    await none.link(`${ID}:/mc/cb?code=c`);
    await settle();
    expect([none.paths(), none.closed(), personActs.of(none.ctx).linked]).toEqual([[], 0, false]);
    const outside = shell(() => new Response(null, { status: 204 }));
    await outside.link(`${ID}:/mcx/cb`);
    await outside.link(`${ID}:/other`);
    await settle();
    expect([outside.paths(), outside.closed()]).toEqual([[], 0]);
    const t = shell(() => new Response(null, { status: 204 }));
    await t.ctx.storage.set(KEY, JSON.stringify({ deadline: 1 }));
    await t.link(`${ID}:/mc/cb?code=c`);
    await settle();
    expect([t.paths(), t.closed(), personActs.of(t.ctx).linked]).toEqual([["/mc/cb?code=c"], 1, true]);
    expect(await t.ctx.storage.get(KEY)).toBe("");
    const exact = shell(() => new Response(null, { status: 204 }));
    await exact.ctx.storage.set(KEY, JSON.stringify({ deadline: 1 }));
    await exact.link(`${ID}:/mc`);
    await settle();
    expect([exact.paths(), exact.closed()]).toEqual([["/mc"], 1]);
  });
});
