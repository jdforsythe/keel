// k.guards Client: the one request a router's `user` read sends and which answers give a user. k.opening Testing:
// which fired events stand for a person's act. Both with no window or document, as a server render runs them.
import { createCtx } from "@keel/ctx";
import type { FireEvent, SimCtx } from "@keel/ctx";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { personActs } from "../src/internal/personActs.ts";
import { returnOpenings } from "../src/internal/returnOpenings.ts";

const SEED = 1337;
const sim = (): SimCtx => createCtx({ mode: "sim", seed: SEED });
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** The answer of a `readUser` loaded afresh, over a net that answers with `answer`, and the requests it sent. */
const read = async (answer: () => Response): Promise<{ user: string; sent: Request[] }> => {
  vi.resetModules();
  const { readUser } = await import("../src/internal/readUser.ts");
  const ctx = sim();
  const sent: Request[] = [];
  ctx.net.route("*", (req) => {
    sent.push(req);
    return answer();
  });
  return { user: await readUser(ctx), sent };
};

describe("readUser", () => {
  it("sends one GET for /__keel/user of the origin, marked x-keel and asking for JSON", async () => {
    const { user, sent } = await read(() => json({ user: "ada" }));
    expect(user).toBe("ada");
    expect(sent).toHaveLength(1);
    const [req] = sent;
    expect(req?.url).toBe("http://localhost/__keel/user");
    expect(req?.method).toBe("GET");
    expect(req?.headers.get("x-keel")).toBe("1");
    expect(req?.headers.get("accept")).toBe("application/json");
  });

  it("answers the user of a 200 with a string of at most 256 characters", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 300 }), async (name) => {
        const { user } = await read(() => json({ user: name }));
        expect(user).toBe(name.length <= 256 ? name : "");
      }),
      { seed: SEED, numRuns: 30 },
    );
    expect((await read(() => json({ user: "x".repeat(256) }))).user).toBe("x".repeat(256));
    expect((await read(() => json({ user: "x".repeat(257) }))).user).toBe("");
  });

  it("answers the empty string for a user that is no string, another body, another status and a failed fetch", async () => {
    for (const body of [
      { user: ["a"] },
      { user: { length: 1 } },
      { user: 5 },
      { user: null },
      {},
      { name: "ada" },
      null,
      "ada",
      5,
      ["ada"],
    ])
      expect((await read(() => json(body))).user, JSON.stringify(body)).toBe("");
    for (const status of [201, 204, 401, 403, 404, 500])
      expect(
        (await read(() => (status === 204 ? new Response(null, { status }) : json({ user: "ada" }, status)))).user,
      ).toBe("");
    expect((await read(() => new Response("not json", { status: 200 }))).user).toBe("");
    expect(
      (
        await read(() => {
          throw new TypeError("offline");
        })
      ).user,
    ).toBe("");
  });
});

describe("personActs", () => {
  it("a ctx starts with no act and is not link-started; each ctx has its own state", () => {
    const a = sim();
    const b = sim();
    expect(personActs.of(a)).toEqual({ acted: false, linked: false });
    expect(personActs.of(a).acted).toBe(false);
    expect(personActs.of(a).linked).toBe(false);
    personActs.fired(a, { type: "click" });
    expect(personActs.of(a)).toEqual({ acted: true, linked: false });
    expect(personActs.of(b)).toEqual({ acted: false, linked: false });
    expect(personActs.of(a)).toBe(personActs.of(a));
  });

  it("a fired click, submit or keydown other than Escape is an act and ends link-started; any other is none", () => {
    const acts: readonly FireEvent[] = [
      { type: "click" },
      { type: "submit" },
      { type: "keydown", key: "Enter" },
      { type: "keydown", key: "a" },
      { type: "keydown", key: "" },
    ];
    const none: readonly FireEvent[] = [
      { type: "keydown", key: "Escape" },
      { type: "input", value: "Escape" },
      { type: "change" },
      { type: "focus" },
      { type: "blur" },
      { type: "emit", detail: { key: "Enter" } },
    ];
    fc.assert(
      fc.property(fc.constantFrom(...acts, ...none), fc.boolean(), (e, linked) => {
        const ctx = sim();
        personActs.of(ctx).linked = linked;
        personActs.fired(ctx, e);
        const act = acts.includes(e);
        expect(personActs.of(ctx), JSON.stringify(e)).toEqual({ acted: act, linked: act ? false : linked });
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("with no window, watch attaches nothing and marks no act", () => {
    const ctx = sim();
    expect(() => personActs.watch(ctx)).not.toThrow();
    expect(personActs.of(ctx)).toEqual({ acted: false, linked: false });
  });
});

describe("returnOpenings with storage that fails", () => {
  it("record and take resolve false", async () => {
    const ctx = sim();
    const failing: SimCtx = {
      ...ctx,
      storage: {
        ...ctx.storage,
        get: async () => {
          throw new Error("storage");
        },
        set: async () => {
          throw new Error("storage");
        },
      },
    };
    expect(await returnOpenings.record(failing)).toBe(false);
    expect(await returnOpenings.take(failing)).toBe(false);
    expect(await returnOpenings.record(ctx, 5)).toBe(true);
    expect(await ctx.storage.get("keel.return")).toBe('{"deadline":600005}');
    expect(await returnOpenings.take(ctx)).toBe(false);
    expect(await returnOpenings.record(ctx)).toBe(true);
    expect(await returnOpenings.take(ctx)).toBe(true);
    expect(await ctx.storage.get("keel.return")).toBe("");
    expect(await returnOpenings.take(ctx)).toBe(false);
  });
});
