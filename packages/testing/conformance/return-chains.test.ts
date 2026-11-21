// @vitest-environment happy-dom
// Spec: k.opening, clause "The link's GET answered 404 records `/api/auth/callback?code=c` on `KEEL_ORIGIN` in `documents()`; a second delivery of the link then sends nothing."
// Spec: k.opening, clause "The link's GET answered 302 to `https://provider.example/b`, or to `/elsewhere` (neither a page nor under the mount), records that URL in `documents()`; a second delivery then sends nothing."
// Spec: k.opening, clause "The link's GET answered 302 to `dev.keel.golden2:/api/auth/y`, whose GET is answered 404, records `/api/auth/y` in `documents()`; a second delivery then sends nothing."
// Spec: k.opening, clause "With no opening first, a `Link` to the mount answered 302 to `dev.keel.golden2:/api/auth/x`, whose GET is answered 302 to `https://provider.example/a`, records that URL in `documents()`; the link then sends one `net` GET."
// Spec: k.opening, clause "The opening made at 1 ms (sim clock): a new ctx at 0 ms given its `keel.return` value admits no link; a new ctx given the value `x` admits no link."
// Spec: k.opening, clause "With a `ctx.storage` whose writes fail, the opening still records `https://provider.example/a` in `documents()`, and the link then sends nothing."
// Spec: k.return, clause "With every GET answered 302 to `dev.keel.golden2:/api/auth/loop`, a `Link` to the mount sends six `net` GETs."
// Seed 1337 (fc.assert below; the sim ctx's seed is 1337). The sim clock starts at 0 and moves only through `advance` (k.sim).
// ASSUMED: "The link" is delivered with `handle.returnLink`, its own GET answered by the test; a link that was not admitted sends no `net` request.
// ASSUMED: a `documents()` entry for a URL on KEEL_ORIGIN holds an absolute or rooted URL whose path and search are the request's; compared by `pathname + search` only (the origin is the harness's).
// ASSUMED: `ctx.storage` of a sim ctx may have its `set` and `commit` replaced on the object to make writes fail; reads stay as they were. The write fails by rejecting.
// ASSUMED: the `keel.return` value read after an opening is a string, and a second sim ctx accepts it through `set` (as return-opening.test.ts).
// ASSUMED: in the six-GETs test every GET is answered 302 to the loop as the spec says, but the 13th request (never made by a conforming build) is answered 404 so a build that does not count stops instead of looping.
// ASSUMED: a link's 404 answer is `new Response(null, { status: 404 })`; "a second delivery sends nothing" means no new `net` request and no new `documents()` entry.
import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { PROVIDER, SCHEME, SEED, START, beginOpening, closeAll, openShell, redirect, ticks } from "./return-support.ts";
import type { Answer, Sent } from "./return-support.ts";

afterEach(closeAll);

const CALLBACK_PATH = "/api/auth/callback?code=c";
const CALLBACK = `${SCHEME}:${CALLBACK_PATH}`;
const notFound = (): Response => new Response(null, { status: 404 });
const pathOf = (url: string): string => {
  const u = new URL(url, "http://keel.invalid");
  return u.pathname + u.search;
};

/** Start request answered 302 to the provider; every other request answered by `rest`. */
const withStart =
  (rest: (s: Sent) => Response): Answer =>
  (s) =>
    s.url === START ? redirect(302, PROVIDER) : rest(s);

describe("k.opening: a chain a return link starts records no opening", () => {
  it("the link's GET answered 404 records /api/auth/callback?code=c on KEEL_ORIGIN in documents(); a second delivery of the link then sends nothing", async () => {
    const { handle, sent } = await openShell("mt.home", withStart(notFound));
    await beginOpening(handle);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(sent.map((r) => r.url)).toEqual([START, CALLBACK_PATH]);
    const docs = handle.documents();
    expect(docs.map((d) => [d.method, d.url === PROVIDER ? PROVIDER : pathOf(d.url)])).toEqual([
      ["GET", PROVIDER],
      ["GET", CALLBACK_PATH],
    ]);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(sent).toHaveLength(2);
    expect(handle.documents()).toHaveLength(2);
    handle.dispose();
  });

  for (const [location, recorded] of [
    ["https://provider.example/b", "https://provider.example/b"],
    ["/elsewhere", "/elsewhere"],
  ] as const) {
    it(`the link's GET answered 302 to ${location} records that URL in documents(); a second delivery then sends nothing`, async () => {
      const { handle, sent } = await openShell(
        "mt.home",
        withStart(() => redirect(302, location)),
      );
      await beginOpening(handle);
      await handle.returnLink(CALLBACK);
      await ticks();
      expect(sent.map((r) => r.url)).toEqual([START, CALLBACK_PATH]);
      const last = handle.documents().at(-1);
      expect(handle.documents()).toHaveLength(2);
      expect(last?.method).toBe("GET");
      expect(last?.url === recorded ? last.url : pathOf(last?.url ?? "")).toBe(recorded);
      await handle.returnLink(CALLBACK);
      await ticks();
      expect(sent).toHaveLength(2);
      expect(handle.documents()).toHaveLength(2);
      handle.dispose();
    });
  }

  it("the link's GET answered 302 to dev.keel.golden2:/api/auth/y, whose GET is answered 404, records /api/auth/y in documents(); a second delivery then sends nothing", async () => {
    const { handle, sent } = await openShell(
      "mt.home",
      withStart((s) => (s.url === "/api/auth/y" ? notFound() : redirect(302, `${SCHEME}:/api/auth/y`))),
    );
    await beginOpening(handle);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(sent.map((r) => r.url)).toEqual([START, CALLBACK_PATH, "/api/auth/y"]);
    const docs = handle.documents();
    expect(docs).toHaveLength(2);
    expect(pathOf(docs[1]?.url ?? "")).toBe("/api/auth/y");
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(sent).toHaveLength(3);
    expect(handle.documents()).toHaveLength(2);
    handle.dispose();
  });

  it("with no opening first, a Link to the mount answered 302 to dev.keel.golden2:/api/auth/x, whose GET is answered 302 to https://provider.example/a, records that URL in documents(); the link then sends one net GET", async () => {
    const { handle, sent } = await openShell("mt.home", (s) =>
      s.url === START
        ? redirect(302, `${SCHEME}:/api/auth/x`)
        : s.url === "/api/auth/x"
          ? redirect(302, PROVIDER)
          : redirect(303, "/"),
    );
    await handle.fire("mt.home.github", { type: "click" });
    await ticks();
    expect(sent.map((r) => r.url)).toEqual([START, "/api/auth/x"]);
    expect(handle.documents().map((d) => [d.method, d.url])).toEqual([["GET", PROVIDER]]);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(sent.map((r) => r.url)).toEqual([START, "/api/auth/x", CALLBACK_PATH]);
    handle.dispose();
  });
});

describe("k.opening: the stored value", () => {
  async function admitted(value: (first: string) => string, madeAt: number): Promise<number> {
    closeAll();
    const first = createCtx({ mode: "sim", seed: SEED });
    const a = await openShell(
      "mt.home",
      withStart(() => redirect(303, "/")),
      first,
    );
    await first.clock.advance(madeAt);
    await beginOpening(a.handle);
    const stored = await first.storage.get("keel.return");
    expect(stored).not.toBeNull();
    a.handle.dispose();
    const second = createCtx({ mode: "sim", seed: SEED });
    await second.storage.set("keel.return", value(stored ?? ""));
    const b = await openShell(
      "mt.home",
      withStart(() => redirect(303, "/")),
      second,
    );
    await b.handle.returnLink(CALLBACK);
    await ticks();
    const count = b.sent.length;
    b.handle.dispose();
    return count;
  }

  it("the opening made at 1 ms (sim clock): a new ctx at 0 ms given its keel.return value admits no link", async () => {
    expect(await admitted((v) => v, 1)).toBe(0);
  });

  it("a new ctx given the value x admits no link", async () => {
    expect(await admitted(() => "x", 1)).toBe(0);
  });

  it("control: the opening made at 0 ms, given to a new ctx at 0 ms, admits the link", async () => {
    expect(await admitted((v) => v, 0)).toBe(1);
  });

  it("for any opening time after 0 ms, a new ctx at 0 ms given its value admits no link (deadline more than 600000 ms ahead)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5000 }), async (t) => {
        expect(await admitted((v) => v, t)).toBe(0);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("for any text that is not JSON, a ctx given it as keel.return admits no link", async () => {
    const notJson = fc.string({ maxLength: 20 }).filter((s) => {
      try {
        JSON.parse(s);
        return false;
      } catch {
        return true;
      }
    });
    await fc.assert(
      fc.asyncProperty(notJson, async (text) => {
        expect(await admitted(() => text, 0)).toBe(0);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  it("with a ctx.storage whose writes fail, the opening still records https://provider.example/a in documents(), and the link then sends nothing", async () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const { handle, sent } = await openShell(
      "mt.home",
      withStart(() => redirect(303, "/")),
      ctx,
    );
    const fails = async (): Promise<never> => {
      throw new Error("disk full");
    };
    const restore = { set: ctx.storage.set, commit: ctx.storage.commit };
    Object.assign(ctx.storage, { set: fails, commit: fails });
    await beginOpening(handle);
    Object.assign(ctx.storage, restore);
    expect(handle.documents().map((d) => [d.method, d.url])).toEqual([["GET", PROVIDER]]);
    expect(handle.route().id).toBe("mt.home");
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(sent.map((r) => r.url)).toEqual([START]);
    handle.dispose();
  });
});

describe("k.opening: links admitted never exceed the openings the page started", () => {
  type Op = "open" | "404" | "outside" | "own";
  it("over any sequence of page-started openings and links answered 404, an outside redirect or an own-scheme redirect, the links admitted never exceed the openings, and each opening admits one", async () => {
    const op = fc.constantFrom<Op>("open", "404", "outside", "own");
    await fc.assert(
      fc.asyncProperty(fc.array(op, { minLength: 1, maxLength: 10 }), async (ops) => {
        closeAll();
        const kinds = new Map<string, Op>();
        const { handle, sent } = await openShell("mt.home", (s) => {
          if (s.url === START) return redirect(302, PROVIDER);
          if (s.url === "/api/auth/y") return notFound();
          const kind = kinds.get(s.url);
          if (kind === "404") return notFound();
          if (kind === "outside") return redirect(302, "https://provider.example/b");
          return redirect(302, `${SCHEME}:/api/auth/y`);
        });
        let openings = 0;
        let pending = false;
        let expected = 0;
        let delivered = 0;
        for (const o of ops) {
          if (o === "open") {
            await beginOpening(handle);
            openings += 1;
            pending = true;
          } else {
            const path = `/api/auth/cb${delivered}?code=c`;
            delivered += 1;
            kinds.set(path, o);
            await handle.returnLink(`${SCHEME}:${path}`);
            await ticks();
            if (pending) expected += 1;
            pending = false;
          }
          const admittedNow = sent.filter((r) => r.url.startsWith("/api/auth/cb")).length;
          expect(admittedNow).toBe(expected);
          expect(admittedNow).toBeLessThanOrEqual(openings);
        }
        handle.dispose();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});

describe("k.return: a redirect through the shell's own scheme counts toward the 5 in a row", () => {
  it("with every GET answered 302 to dev.keel.golden2:/api/auth/loop, a Link to the mount sends six net GETs", async () => {
    const { handle, sent } = await openShell("mt.home", (_s, i) =>
      i < 12 ? redirect(302, `${SCHEME}:/api/auth/loop`) : notFound(),
    );
    await handle.fire("mt.home.github", { type: "click" });
    await ticks();
    expect(sent.map((r) => [r.method, r.url])).toEqual([
      ["GET", START],
      ...Array.from({ length: 5 }, () => ["GET", "/api/auth/loop"]),
    ]);
    handle.dispose();
  });
});
