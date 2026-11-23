// @vitest-environment happy-dom
// `commandJob`: one `keel session replay|minimize|to-test` job, called here as the job's test file calls it, on the
// buggy cart fixture. What each op writes to the result file: the replay's fingerprint, error code and unapplied
// index; the minimized session; the redacted session with each `nav`'s route match. With `minimize` and `replay`
// themselves, which the job is made of.
// Seed 1337 (no random inputs)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { buggyRoutes, buggySession } from "../../conformance/fixtures.ts";
import type { CommandJobInput } from "../../src/CommandJobInput.ts";
import { Session } from "../../src/Session.schema.ts";
import { commandJob } from "../../src/commandJob.ts";
import { JobResult } from "../../src/internal/JobResult.ts";
import { isInput } from "../../src/internal/isInput.ts";
import { minimize } from "../../src/minimize.ts";
import { replay } from "../../src/replay.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-command-job-"));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
let jobs = 0;

/** Run one job and read back what it wrote. */
async function job(
  op: CommandJobInput["op"],
  session: unknown,
  over: Partial<CommandJobInput> = {},
): Promise<JobResult> {
  const result = path.join(dir, `job-${jobs++}.result.json`);
  await commandJob({ op, session, result, routes: [buggyRoutes()], ...over });
  const parsed = JobResult.parse(JSON.parse(fs.readFileSync(result, "utf8")));
  if (!parsed.ok) throw new Error(`the job wrote a JobResult: ${parsed.error.message}`);
  return parsed.value;
}
const inputsOf = (s: Session): string[] =>
  s.events.filter(isInput).map((e) => (e.kind === "fire" ? `${e.id} ${e.event.type}` : e.kind));
const none = { session: null, navs: [], minimal: false };

describe("commandJob: replay", () => {
  test("a session that reproduces: its fingerprint, its error's code, nothing unapplied, one run", async () => {
    const session = await buggySession();
    expect(await job("replay", Session.encode(session))).toEqual({
      reproduced: true,
      fingerprint: session.fingerprint,
      error: "keel.unexpected",
      unapplied: null,
      runs: 1,
      ...none,
    });
  });

  test("a session recorded with another fingerprint: not reproduced, and the fingerprint the replay got", async () => {
    const session = await buggySession();
    const r = await job("replay", Session.encode({ ...session, fingerprint: "000000000000" }));
    expect(r).toEqual({
      reproduced: false,
      fingerprint: session.fingerprint,
      error: "keel.unexpected",
      unapplied: null,
      runs: 1,
      ...none,
    });
  });

  test("a session with no error replays to no error", async () => {
    const session = await buggySession();
    const calm = { ...session, events: session.events.slice(0, 2), error: null };
    const r = await job("replay", Session.encode(calm));
    expect(r).toMatchObject({ error: null, unapplied: null, runs: 1, session: null });
    expect(r.reproduced).toBe(false);
    const fingerprint = r.fingerprint;
    expect(await job("replay", Session.encode({ ...calm, fingerprint }))).toMatchObject({
      reproduced: true,
      fingerprint,
    });
  });

  test("an input that does not apply is named by its index and the replay stops there", async () => {
    const session = await buggySession();
    const events = [
      ...session.events.slice(0, 2),
      { at: session.events[1]?.at ?? 0, kind: "fire" as const, id: "cart.gone", event: { type: "click" as const } },
      ...session.events.slice(2),
    ];
    const r = await job("replay", Session.encode({ ...session, events }));
    expect(r).toMatchObject({ reproduced: false, unapplied: 2, runs: 1, session: null });
    expect(r.error).not.toBe("keel.unexpected");
    expect(r.fingerprint).not.toBe(session.fingerprint);
  });

  test("a session that does not parse is refused before any replay", async () => {
    await expect(
      commandJob({ op: "replay", session: { v: 2 }, result: path.join(dir, "none.json"), routes: [buggyRoutes()] }),
    ).rejects.toThrow("keel session job: the session does not parse");
    expect(fs.existsSync(path.join(dir, "none.json"))).toBe(false);
  });

  test("minimize and to-test of a session that does not reproduce stop after the one replay", async () => {
    const session = await buggySession();
    const other = Session.encode({ ...session, fingerprint: "000000000000" });
    for (const op of ["minimize", "to-test"] as const)
      expect(await job(op, other), op).toEqual({
        reproduced: false,
        fingerprint: session.fingerprint,
        error: "keel.unexpected",
        unapplied: null,
        runs: 1,
        ...none,
      });
  });
});

describe("commandJob: minimize", () => {
  test("the session comes back with the two inputs that reproduce it, 1-minimal", async () => {
    const session = await buggySession();
    expect(inputsOf(session)).toEqual([
      "cart.add click",
      "cart.card input",
      "cart.card input",
      "nav",
      "cart.add click",
      "cart.checkout click",
    ]);
    const r = await job("minimize", Session.encode(session));
    expect(r).toMatchObject({
      reproduced: true,
      fingerprint: session.fingerprint,
      error: "keel.unexpected",
      unapplied: null,
      navs: [],
      minimal: true,
    });
    if (r.session === null) throw new Error("minimize answers a session");
    expect(inputsOf(r.session)).toEqual(["cart.add click", "cart.checkout click"]);
    expect(r.session.fingerprint).toBe(session.fingerprint);
    expect(r.session.error?.code).toBe("keel.unexpected");
    expect(r.session).toMatchObject({
      v: 1,
      id: session.id,
      seed: session.seed,
      at: session.at,
      route: session.route,
      state: session.state,
    });
    expect(r.runs).toBeGreaterThan(2);
    expect(r.runs).toBeLessThan(20);
    expect(await job("replay", Session.encode(r.session))).toMatchObject({ reproduced: true, runs: 1 });
    const again = await job("minimize", Session.encode(session));
    expect(again).toEqual(r);
  });

  test("--max-runs bounds the replays: at the bound the smallest set found so far comes back, not called minimal", async () => {
    const session = await buggySession();
    const one = await job("minimize", Session.encode(session), { maxRuns: 1 });
    expect(one).toMatchObject({ reproduced: true, runs: 1, minimal: false });
    expect(one.session === null ? [] : inputsOf(one.session)).toEqual(inputsOf(session));
    const full = await job("minimize", Session.encode(session));
    const short = await job("minimize", Session.encode(session), { maxRuns: full.runs - 1 });
    expect(short).toMatchObject({ runs: full.runs - 1, minimal: false });
    const exact = await job("minimize", Session.encode(session), { maxRuns: full.runs });
    expect(exact.runs).toBe(full.runs);
    expect(exact.session === null ? [] : inputsOf(exact.session)).toEqual(["cart.add click", "cart.checkout click"]);
  });
});

describe("minimize", () => {
  test("removing either kept input no longer reproduces; the result is the same from run to run", async () => {
    const session = await buggySession();
    const routes = buggyRoutes();
    const a = await minimize(session, { routes });
    const b = await minimize(session, { routes });
    expect(a).toEqual(b);
    if (!a.ok) throw new Error("the buggy session minimizes");
    expect(a.value.minimal).toBe(true);
    const inputs = a.value.session.events.filter(isInput);
    expect(inputs).toHaveLength(2);
    for (const drop of inputs) {
      const fewer = { ...a.value.session, events: a.value.session.events.filter((e) => e !== drop) };
      expect((await replay(fewer, { routes })).reproduced).toBe(false);
    }
    expect((await replay(a.value.session, { routes })).reproduced).toBe(true);
  });

  test("the kept inputs keep their recorded times and the observations of their replay follow them in order", async () => {
    const session = await buggySession();
    const m = await minimize(session, { routes: buggyRoutes() });
    if (!m.ok) throw new Error("the buggy session minimizes");
    const events = m.value.session.events;
    expect(events.map((e) => e.kind)).toEqual(["fire", "tx", "fire", "error"]);
    const recorded = session.events.filter(isInput);
    expect(events[0]).toEqual(recorded[0]);
    expect(events[2]).toEqual(recorded.at(-1));
    expect(events.at(-1)).toMatchObject({ kind: "error", route: "cart.show", error: { code: "keel.unexpected" } });
  });

  test("a session that does not reproduce is sessions.notReproduced with the fingerprint its replay got", async () => {
    const session = await buggySession();
    const r = await minimize({ ...session, fingerprint: "000000000000" }, { routes: buggyRoutes() });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.error).toMatchObject({ code: "sessions.notReproduced", data: { fingerprint: session.fingerprint } });
  });

  test("a session with a single input that reproduces keeps it; one with no input keeps none", async () => {
    const session = await buggySession();
    const routes = buggyRoutes();
    const seeded = { ...session, state: { "cart.cart": { items: ["a"], card: "", note: "", pinSet: false } } };
    const single = { ...seeded, events: session.events.filter((e) => e.kind === "fire" && e.id === "cart.checkout") };
    const one = await minimize(single, { routes });
    expect(one.ok && inputsOf(one.value.session)).toEqual(["cart.checkout click"]);
    expect(one.ok && one.value.minimal).toBe(true);
    const none = { ...session, events: [], error: null };
    const calm = await replay(none, { routes });
    expect(calm.error).toBeNull();
  });
});

describe("commandJob: to-test", () => {
  test("the session comes back redacted, still reproducing, after two runs, with each nav's route match", async () => {
    const session = await buggySession();
    const r = await job("to-test", Session.encode(session));
    expect(r).toMatchObject({
      reproduced: true,
      fingerprint: session.fingerprint,
      error: "keel.unexpected",
      unapplied: null,
      runs: 2,
      minimal: false,
    });
    if (r.session === null) throw new Error("to-test answers a session");
    expect(inputsOf(r.session)).toEqual(inputsOf(session));
    const navAt = session.events.findIndex((e) => e.kind === "nav");
    expect(r.navs).toEqual([{ index: navAt, id: "cart.show", params: {}, search: {} }]);
    expect(r.session.fingerprint).toBe(session.fingerprint);
    expect(r.session.id).toBe(session.id);
  });

  test("a typed value is written as x repeated unless an expose entry names it", async () => {
    const session = await buggySession();
    const typed = session.events.findIndex((e) => e.kind === "fire" && e.event.type === "input");
    const marked = {
      ...session,
      events: session.events.map((e, i) =>
        i === typed && e.kind === "fire"
          ? { ...e, id: "cart.note", event: { type: "input" as const, value: "MARKNOTE" } }
          : e,
      ),
    };
    const hidden = await job("to-test", Session.encode(marked));
    expect(hidden.reproduced).toBe(true);
    expect(JSON.stringify(hidden.session)).not.toContain("MARKNOTE");
    expect(hidden.session?.events[typed]).toMatchObject({
      id: "cart.note",
      event: { type: "input", value: "xxxxxxxx" },
    });
    const shown = await job("to-test", Session.encode(marked), { expose: ["el:cart.note#value"] });
    expect(shown.session?.events[typed]).toMatchObject({
      id: "cart.note",
      event: { type: "input", value: "MARKNOTE" },
    });
  });

  test("the serving modules' redact entries are bound on each replay, and the job still reproduces", async () => {
    const session = await buggySession();
    const r = await job("to-test", Session.encode(session), {
      redact: ["tx:cart.setCard#number", "el:cart.card#value"],
    });
    expect(r).toMatchObject({ reproduced: true, runs: 2 });
    const replayed = await job("replay", Session.encode(session), { redact: ["tx:cart.setCard#number"] });
    expect(replayed).toMatchObject({ reproduced: true, runs: 1 });
  });
});
