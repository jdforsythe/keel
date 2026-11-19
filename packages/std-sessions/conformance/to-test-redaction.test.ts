// @vitest-environment happy-dom
// Spec: std.sessions, clause "A `to-test` file holds no recorded `s.string()` value outside `expose`, and no `s.secret` or password value."
// Seed 1337
import { run } from "@keel/cli";
import { afterAll, describe, expect, test } from "vitest";
import { MARKERS, applyTo, diskFixture, exposingModule, markedSession, sessionFile } from "./fixtures.ts";

describe("std.sessions: to-test redaction", () => {
  const fx = diskFixture();
  afterAll(() => fx.dispose());

  const emitted = async (): Promise<string> => {
    fx.write("modules/cart/module.ts", exposingModule(["store:cart.cart#note"]));
    fx.write("sessions/failing.json", sessionFile(await markedSession()));
    const sources: string[] = [];
    const apply = applyTo(fx.dir);
    const r = await run(["session", "to-test", "sessions/failing.json"], {
      cwd: fx.dir,
      files: fx.files(),
      apply: (w) => {
        for (const x of w) if (x.content !== null) sources.push(x.content);
        apply(w);
      },
    });
    expect(r.code).toBe(0);
    return sources.join("\n");
  };

  test("A `to-test` file keeps the s.string() value an `expose` entry names", async () => {
    expect(await emitted()).toContain(MARKERS.exposed);
  }, 120_000);

  test("A `to-test` file holds no recorded s.string() value outside `expose`, and no s.secret or password value", async () => {
    const text = await emitted();
    for (const [name, marker] of Object.entries(MARKERS.hidden)) {
      expect(text, name).not.toContain(marker);
    }
  }, 120_000);
});
