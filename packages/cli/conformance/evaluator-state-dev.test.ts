// Spec: k.evaluator, clause "In the copy of k.derived clause 9 whose linked `@keel/std-text` takes `line`'s default `min` from `Math.n = (Math.n ?? 0) + 1` at import time, while `keel dev` serves it, after each of three edits that add a comment line to a contract file, `.keel/surface.json` is within 2 s byte-identical to what `keel build` of that tree writes."
// Also states, k.evaluator: "An evaluation's global object, intrinsics, module instances, timers and pending promises are its own and end with it; nothing the command's process holds (a dev server's globals, an earlier evaluation's write to `Math`) reaches it, and nothing it does reaches the command's process but its result."
// Also states, k.evaluator Realm: "A write to it, to an intrinsic (`Math`, `Error.stackTraceLimit`) or to a pure built-in's defaults (`util.inspect.defaultOptions`) stays in that evaluation."
// Seed 1337 (recorded); no random inputs. One `keel dev` per case on a free port over a copy of apps/household, stopped (its process group, which this file spawned) in `afterAll`; "within 2 s" is counted on the monotonic clock from the write, polling the file's content every 25 ms.
// "The copy of k.derived clause 9" is the household copy with `@keel/std-text` linked outside `node_modules` (derived-support.ts `householdTree`). The clause's `Math.n = (Math.n ?? 0) + 1` is written with `Reflect` (same effect, no type error in the linked copy) as a module-level constant of `line.ts` that `line`'s default `min` takes.
// A comment-only edit leaves the views as they were, so equality alone is met before the dev server has evaluated; each case therefore ends with an edit that changes the API path `/api/household` of the contract file (a view change only a finished evaluation shows) and asserts the views equal what `keel build` writes for that tree, so a counter that crossed evaluations (a fifth evaluation giving a larger default) differs from the build.
// The second and third cases put the state in a dependency `p` of the guard (`Math.__n = (Math.__n ?? 0) + 1`, `Error.stackTraceLimit = 0`), whose value reaches `routes.json` through the guard's redirect (`members.signin` while it is `"1"`, the first evaluation's value), and use four path edits so the last is the fifth evaluation of one `keel dev`.
// ASSUMED: "the same derivation on the fifth evaluation as a fresh `keel check`" is the dev server's `.keel/routes.json` and `.keel/surface.json` byte-identical to those of a `keel check` of the same final tree; "a later E1050 is still placed" is the dev output holding an `E1050` line that names `node:child_process.execSync` and `modules/setup/gate.guard.ts`.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixedTime, testTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import {
  type Tree,
  brief,
  build,
  cloneTree,
  dropTree,
  editStdText,
  householdTree,
  nap,
  nowMs,
  put,
  sub,
  until,
  views,
} from "./derived-support.ts";
import { type Dev, SIGNIN, gFixture, keelBounded, startDev } from "./evaluator-support.ts";

const SLOW = testTime(600_000);
const WITHIN = fixedTime(2_000);
const CONTRACT = "modules/setup/setup.contract.ts";
const API = '"/api/household"';

let house: Tree | undefined;
const made: Tree[] = [];
const devs: Dev[] = [];
afterAll(async () => {
  for (const d of devs) await d.stop();
  for (const t of made) dropTree(t);
});
const copy = (): Tree => {
  house ??= householdTree();
  if (!made.includes(house)) made.push(house);
  const t = cloneTree(house);
  made.push(t);
  return t;
};

/** Milliseconds after now at which `ok` first held, polling every 25 ms for `WITHIN` (undefined when it never did). */
function within(ok: () => boolean): number | undefined {
  const start = nowMs();
  while (nowMs() - start < WITHIN) {
    if (ok()) return Math.round(nowMs() - start);
    nap(25);
  }
  return ok() ? Math.round(nowMs() - start) : undefined;
}

/** The text of `rel` in `dir`, empty when the file is absent or being replaced. */
function tryRead(dir: string, rel: string): string {
  try {
    return readFileSync(join(dir, rel), "utf8");
  } catch {
    return "";
  }
}

/** Replaces the API path `from` by `to` in the contract file. */
const pathEdit = (dir: string, from: string, to: string): void => sub(dir, CONTRACT, `"${from}"`, `"${to}"`);

describe("k.evaluator: state does not cross evaluations", () => {
  test(
    "in the copy of k.derived clause 9 whose linked `@keel/std-text` takes `line`'s default `min` from `Math.n = (Math.n ?? 0) + 1` at import time, while `keel dev` serves it, after each of three edits that add a comment line to a contract file, `.keel/surface.json` is within 2 s byte-identical to what `keel build` of that tree writes",
    async () => {
      const t = copy();
      // `line`'s default `min` is the counter after one increment at import time (a module-level constant), whatever the number of `line` calls
      const files = editStdText(t, "min ?? 1", "min ?? KEEL_N", false);
      for (const rel of files) {
        const file = join(t.base, rel);
        writeFileSync(
          file,
          `const KEEL_N = (Reflect.set(Math, "n", Number(Reflect.get(Math, "n") ?? 0) + 1), Number(Reflect.get(Math, "n")));\n${readFileSync(file, "utf8")}`,
        );
      }
      const served = cloneTree(t);
      made.push(served);
      const plain = cloneTree(served);
      made.push(plain);
      build(plain.dir);
      const wantPlain = views(plain.dir);
      const moved = cloneTree(served);
      made.push(moved);
      pathEdit(moved.dir, "/api/household", "/api/home");
      build(moved.dir);
      const wantMoved = views(moved.dir);
      const dev = await startDev(served.dir, 120_000);
      devs.push(dev);
      expect(dev.child.exitCode, dev.output()).toBeNull();
      for (let n = 1; n <= 3; n += 1) {
        sub(served.dir, CONTRACT, "export const setup", `// edit ${String(n)}\nexport const setup`);
        const at = within(() => tryRead(served.dir, ".keel/surface.json") === wantPlain[".keel/surface.json"]);
        expect(
          at,
          `edit ${String(n)}: ms until surface.json matched (output: ${dev.output().slice(-300)})`,
        ).toBeLessThanOrEqual(2_000);
      }
      // a view change only a finished evaluation shows: the fourth edit moves the API path
      pathEdit(served.dir, "/api/household", "/api/home");
      const at = within(() => tryRead(served.dir, ".keel/surface.json") === wantMoved[".keel/surface.json"]);
      expect(
        at,
        `ms until surface.json matched the build's after the path edit (output: ${dev.output().slice(-300)})`,
      ).toBeLessThanOrEqual(2_000);
      expect(tryRead(served.dir, ".keel/routes.json")).toBe(wantMoved[".keel/routes.json"]);
      await dev.stop();
    },
    SLOW,
  );

  test(
    "a dependency that sets `Math.__n = (Math.__n ?? 0) + 1` and `Error.stackTraceLimit = 0` gives, on the fifth evaluation of one `keel dev`, the derivation of a fresh `keel check`, and a later E1050 is still placed",
    async () => {
      const served = copy();
      gFixture(
        served,
        "Math.__n = (Math.__n ?? 0) + 1;\nError.stackTraceLimit = 0;\nexport default Math.__n === 1 ? '1' : '2';\n",
      );
      const fresh = cloneTree(served);
      made.push(fresh);
      const steps = ["/api/household", "/api/h1", "/api/h2", "/api/h3", "/api/h4"];
      for (let i = 1; i < steps.length; i += 1) pathEdit(fresh.dir, steps[i - 1] ?? "", steps[i] ?? "");
      const checked = keelBounded(fresh.dir, ["check"], 120_000);
      expect(checked.status, brief(checked)).toBe(0);
      const want = views(fresh.dir);
      expect(want[".keel/routes.json"], "the fresh derivation takes the first evaluation's value").toContain(SIGNIN);

      const dev = await startDev(served.dir, 120_000);
      devs.push(dev);
      expect(dev.child.exitCode, dev.output()).toBeNull();
      for (let i = 1; i < steps.length; i += 1) {
        pathEdit(served.dir, steps[i - 1] ?? "", steps[i] ?? "");
        const to = steps[i] ?? "";
        const at = within(() => tryRead(served.dir, ".keel/surface.json").includes(to));
        expect(
          at,
          `evaluation ${String(i + 1)}: ms until surface.json held ${to} (output: ${dev.output().slice(-300)})`,
        ).toBeLessThanOrEqual(2_000);
      }
      const equal = within(
        () =>
          tryRead(served.dir, ".keel/routes.json") === want[".keel/routes.json"] &&
          tryRead(served.dir, ".keel/surface.json") === want[".keel/surface.json"],
      );
      expect(equal, "ms until the fifth evaluation's views equalled a fresh `keel check`'s").toBeLessThanOrEqual(2_000);

      // a later refusal is placed at the project file and call, though `Error.stackTraceLimit` was zeroed by an earlier evaluation
      put(
        served.dir,
        "modules/setup/gate.guard.ts",
        `import v from "p";
import { execSync } from "node:child_process";
import { guard } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";

void v;
execSync("true");

export const gate = guard({ redirect: "app.start" }, async ({ user }) =>
  user === "" ? err(keelError.denied.make({}, "sign in first")) : ok(null),
);
`,
      );
      const placed = await until(
        () =>
          dev
            .output()
            .split("\n")
            .some(
              (l) =>
                l.includes("E1050") &&
                l.includes("node:child_process.execSync") &&
                l.includes("modules/setup/gate.guard.ts"),
            ),
        testTime(60_000),
      );
      expect(placed, dev.output()).toBe(true);
      await dev.stop();
    },
    SLOW,
  );
});
