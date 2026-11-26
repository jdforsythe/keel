// Two signed-in users add a recipe with the same title at once. The kitchen's unique index on lower(title) decides:
// exactly one is saved and the other gets the app's answer for a taken title, 422 `keel.fields` on `title`.
// std.postgres: "a unique ... violation is `postgres.constraint`"; "A lone `query`, `one` or `run` is its own
// `serializable` transaction, rerun as `fn` is"; past its third run it is `keel.conflict`, which k.server answers 409. Runs on sim, on PGlite, and on Postgres 17 where
// `KEEL_TEST_POSTGRES_URL` is set. Seed 1337.
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { s } from "@keel/schema";
import { createApp } from "@keel/server";
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Box } from "../modules/kitchen/Box.schema.ts";
import topology from "../topology.ts";
import { apiRoutes } from "./apiRoutes.ts";
import { NOW, asJson, asUser, draft } from "./simApi.ts";

const SEED = 1337;
const PG17 = process.env.KEEL_TEST_POSTGRES_URL ?? "";

const BoxBody = s.object({
  id: s.string(),
  results: s.object({ "kitchen.box": s.object({ ok: s.literal(true), value: Box }) }),
});
const Fields = s.object({
  ok: s.literal(false),
  error: s.object({ code: s.literal("keel.fields"), message: s.string(), data: s.object({ title: s.string() }) }),
});

type Step = { delay: number; fault: "none" | "unavailable" | "conflict" };
const none = (n: number): Step[] => Array.from({ length: n }, () => ({ delay: 0, fault: "none" }));

const simServer = (plan: Step[] = none(50)): Ctx => {
  const ctx = createCtx({
    mode: "sim",
    seed: SEED,
    schedule: { net: [], storage: [], offline: [], plans: { "kitchen.db": plan } },
  });
  ctx.clock.advance(NOW);
  return ctx;
};

const dir = mkdtempSync(join(tmpdir(), "golden-2-race-"));
const before = process.env.KEEL_POSTGRES_URL;
afterAll(() => {
  if (before === undefined) Reflect.deleteProperty(process.env, "KEEL_POSTGRES_URL");
  else process.env.KEEL_POSTGRES_URL = before;
  rmSync(dir, { recursive: true, force: true });
});
let real = 0;
/** A real-mode server on `url`; the recipes table is shared across tests there, so each test uses its own titles. */
const realServer = (url: string) => (): Ctx => {
  process.env.KEEL_POSTGRES_URL = url;
  real += 1;
  return createCtx({ mode: "real", seed: SEED + real });
};

/**
 * The bound on a mode's first request. A PGlite folder's first query loads the engine, runs initdb on disk and
 * migrates: about 0.7 s on a quiet machine, where a property run after it takes about 5 ms, and over 5 s on a
 * starved CI runner. std-postgres bounds its own PGlite tests the same.
 */
const OPEN_MS = fixedTime(60_000);

const MODES: { name: string; server: () => Ctx; opens: boolean }[] = [
  { name: "sim", server: () => simServer(), opens: false },
  { name: "pglite", server: realServer(`pglite:${join(dir, "pg")}`), opens: true },
  ...(PG17 === "" ? [] : [{ name: "postgres 17", server: realServer(PG17), opens: true }]),
];

/** Two api replicas over one database, each request made by its own user. */
const twoUsers = async (server: Ctx) => {
  const as = (user: string) =>
    createApp({ topology, routes: apiRoutes, ctx: server, deployable: "api", identity: asUser(user) });
  return { ana: await as("ana"), ben: await as("ben") };
};

const answer = async (res: Promise<Response>) => {
  const r = await res;
  const body: unknown = await r.json();
  return { status: r.status, body };
};

const titlesOf = async (app: { fetch(r: Request): Promise<Response> }) => {
  const listed = BoxBody.parse((await answer(app.fetch(asJson("GET", "/api/recipes")))).body);
  return listed.ok ? listed.value.results["kitchen.box"].value.recipes.map((r) => r.title) : [];
};

// One tag per process, so titles never collide with an earlier run on a shared server.
const RUN = randomBytes(3).toString("hex");
let tag = 0;
for (const m of MODES) {
  describe(`two users add one title at once on ${m.name}`, () => {
    // The database opens here, under its own bound, so the test's bound holds the property runs alone.
    beforeAll(
      async () => {
        const { ana, ben } = await twoUsers(m.server());
        await titlesOf(ana);
        await ana.close();
        await ben.close();
      },
      m.opens ? OPEN_MS : undefined,
    );
    it("saves exactly one; the other gets 422 keel.fields on title", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom("Soup", "Lentil stew", "Pie"),
          fc.boolean(),
          fc.boolean(),
          async (base, upper, benFirst) => {
            tag += 1;
            const title = m.name === "sim" ? base : `${base} ${RUN}${tag}`;
            const { ana, ben } = await twoUsers(m.server());
            const send = (app: typeof ana, t: string) =>
              answer(app.fetch(asJson("POST", "/api/recipes", draft(t, 30))));
            const other = upper ? title.toUpperCase() : title;
            const [a, b] = benFirst
              ? await Promise.all([send(ben, other), send(ana, title)])
              : await Promise.all([send(ana, title), send(ben, other)]);
            expect([a.status, b.status].sort()).toEqual([200, 422]);
            const lost = a.status === 422 ? a : b;
            const fields = Fields.parse(lost.body);
            expect(fields.ok).toBe(true);
            const saved = (await titlesOf(ana)).filter((t) => t.toLowerCase() === title.toLowerCase());
            expect(saved).toHaveLength(1);
            expect(await titlesOf(ben)).toEqual(await titlesOf(ana));
            await ana.close();
            await ben.close();
          },
        ),
        { seed: SEED, numRuns: m.name === "sim" ? 10 : 4 },
      );
    });
  });
}

describe("planned serialization failures on the kitchen database (sim)", () => {
  it("reruns the add past one and saves it once", async () => {
    const server = simServer([{ delay: 0, fault: "conflict" }, ...none(20)]);
    const { ana, ben } = await twoUsers(server);
    const added = await answer(ana.fetch(asJson("POST", "/api/recipes", draft("Soup", 30))));
    expect(added.status).toBe(200);
    expect(await titlesOf(ben)).toEqual(["Soup"]);
    await ana.close();
    await ben.close();
  });

  it("answers the add 409 keel.conflict past three and saves nothing; a retry lands", async () => {
    const conflict = { delay: 0, fault: "conflict" as const };
    const server = simServer([conflict, conflict, conflict, ...none(20)]);
    const { ana, ben } = await twoUsers(server);
    const lost = await answer(ana.fetch(asJson("POST", "/api/recipes", draft("Soup", 30))));
    expect(lost.status).toBe(409);
    expect(JSON.stringify(lost.body)).toContain("keel.conflict");
    expect(await titlesOf(ben)).toEqual([]);
    const retried = await answer(ben.fetch(asJson("POST", "/api/recipes", draft("Soup", 30))));
    expect(retried.status).toBe(200);
    expect(await titlesOf(ana)).toEqual(["Soup"]);
    await ana.close();
    await ben.close();
  });
});
