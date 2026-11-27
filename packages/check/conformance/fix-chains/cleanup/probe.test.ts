// Spec: k.fixes, clause "The chain `cleanup` has no step: `keel check` reports nothing on its start."
// Seed 1337. The end is the start; this probe runs it: the cleanup runs on success and on failure, after `use`, and the failure goes on as itself.
import { expect, test } from "vitest";
import { withHandle } from "./end/withHandle.ts";

test("close runs after use on success", () => {
  const log: string[] = [];
  run({ close: () => void log.push("close") }, () => void log.push("use"));
  expect(log).toEqual(["use", "close"]);
});

test("close runs after use on failure, and the failure goes on as itself", () => {
  const log: string[] = [];
  const w = new Error("w");
  let got: unknown;
  try {
    run({ close: () => void log.push("close") }, () => {
      log.push("use");
      throw w;
    });
  } catch (e) {
    got = e;
  }
  expect(got).toBe(w);
  expect(log).toEqual(["use", "close"]);
});
