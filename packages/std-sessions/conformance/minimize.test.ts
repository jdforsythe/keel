// @vitest-environment happy-dom
// Spec: std.sessions, clause "`minimize` output reproduces the fingerprint; removing any one of its input events does not; two runs are equal."
// Seed 1337

import fs from "node:fs";
import path from "node:path";
import { run } from "@keel/cli";
import { Session } from "@keel/std-sessions";
import { replay } from "@keel/std-sessions/replay";
import { minimize } from "@keel/std-sessions/minimize";
import { afterAll, describe, expect, test } from "vitest";
import { applyTo, buggyRoutes, buggySession, diskFixture, sessionFile } from "./fixtures.ts";

const encoded = (s: Session): string => JSON.stringify(Session.encode(s));

const minimal = async () => {
  const r = await minimize(await buggySession(), { routes: buggyRoutes() });
  if (!r.ok) throw new Error("minimize failed");
  return r.value;
};

const isInput = (e: Session["events"][number]): boolean => e.kind === "fire" || e.kind === "nav";

describe("std.sessions: minimize", () => {
  test("`minimize` output reproduces the fingerprint", async () => {
    const { session } = await minimal();
    expect((await replay(session, { routes: buggyRoutes() })).reproduced).toBe(true);
  }, 60_000);

  test("`minimize` output keeps only the inputs cart.add click then cart.checkout click", async () => {
    const { session } = await minimal();
    const inputs = session.events.flatMap((e) => (e.kind === "fire" ? [e.id] : e.kind === "nav" ? ["nav"] : []));
    expect(inputs).toEqual(["cart.add", "cart.checkout"]);
  }, 60_000);

  test("removing any one of its input events does not", async () => {
    const { session } = await minimal();
    const inputs = session.events.filter(isInput);
    expect(inputs.length).toBeGreaterThan(0);
    for (const drop of inputs) {
      const events = session.events.filter((e) => e !== drop);
      expect((await replay({ ...session, events }, { routes: buggyRoutes() })).reproduced).toBe(false);
    }
  }, 60_000);

  test("two runs are equal", async () => {
    const a = await minimal();
    const b = await minimal();
    expect(encoded(a.session)).toBe(encoded(b.session));
  }, 60_000);
});

describe("std.sessions: minimize (keel session minimize)", () => {
  const fx = diskFixture();
  afterAll(() => fx.dispose());

  test("`keel session minimize` rewrites the file with the minimized session", async () => {
    fx.write("sessions/failing.json", sessionFile(await buggySession()));
    const r = await run(["session", "minimize", "sessions/failing.json"], {
      cwd: fx.dir,
      files: fx.files(),
      apply: applyTo(fx.dir),
    });
    expect(r.code).toBe(0);
    const onDisk: unknown = JSON.parse(fs.readFileSync(path.join(fx.dir, "sessions/failing.json"), "utf8"));
    expect(onDisk).toEqual(Session.encode((await minimal()).session));
  }, 120_000);
});
