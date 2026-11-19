// @vitest-environment happy-dom
// Spec: std.sessions, clause "The `to-test` file passes `keel check`, fails under `keel test` on the buggy fixture, and passes once the fix is applied."
// Seed 1337

import fs from "node:fs";
import path from "node:path";
import { check } from "@keel/check";
import { run } from "@keel/cli";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { applyTo, buggySession, diskFixture, sessionFile } from "./fixtures.ts";

describe("std.sessions: to-test", () => {
  const fx = diskFixture();
  const written: string[] = [];
  let emitted = "";
  afterAll(() => fx.dispose());

  beforeAll(async () => {
    fx.write("sessions/failing.json", sessionFile(await buggySession()));
    const apply = applyTo(fx.dir);
    const r = await run(["session", "to-test", "sessions/failing.json"], {
      cwd: fx.dir,
      files: fx.files(),
      apply: (w) => {
        for (const x of w) if (x.content !== null) written.push(x.path);
        apply(w);
      },
    });
    expect(r.code).toBe(0);
    emitted = written.find((p) => /^modules\/cart\/test\/session-[0-9a-f]{12}\.test\.ts$/.test(p)) ?? "";
  }, 120_000);

  test("`keel session to-test` writes modules/cart/test/session-<fingerprint>.test.ts", () => {
    expect(emitted).toMatch(/^modules\/cart\/test\/session-[0-9a-f]{12}\.test\.ts$/);
  });

  test("the emitted file starts with the session header and ends in the no-errors expectation", () => {
    const source = fs.readFileSync(path.join(fx.dir, emitted), "utf8");
    expect(source).toMatch(/^\/\/ Session: [0-9a-f]{12}, seed 1337\n/);
    expect(source).toContain("expect(rec.errors()).toEqual([])");
  });

  test("The `to-test` file passes `keel check`", () => {
    const files = fx.files().filter((f) => f.path.endsWith(".ts"));
    expect(files.map((f) => f.path)).toContain(emitted);
    expect(check(files, { root: fx.dir }).summary.errors).toBe(0);
  });

  test("The `to-test` file fails under `keel test` on the buggy fixture", async () => {
    const r = await run(["test", emitted], { cwd: fx.dir, files: fx.files() });
    expect(r.code).toBe(1);
  }, 120_000);

  test("The `to-test` file passes once the fix is applied", async () => {
    fx.fix();
    const r = await run(["test", emitted], { cwd: fx.dir, files: fx.files() });
    expect(r.code).toBe(0);
  }, 120_000);
});
