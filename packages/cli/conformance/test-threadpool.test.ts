// Spec: k.drive-law, Conformance "`keel test` over a project whose one test records `process.env.UV_THREADPOOL_SIZE` and starts four `node:crypto` `pbkdf2` calls at once, the first of 200,000 iterations and the others of 1, recording each index as it answers: the record is `'1'` and `[0, 1, 2, 3]`, with `UV_THREADPOOL_SIZE=4` in `keel test`'s environment too; plain vitest over it records `'4'` with `UV_THREADPOOL_SIZE=4`."
// Spec: k.drive-law, Order "`keel test` starts every process that runs a test file with `UV_THREADPOOL_SIZE` `1`, whatever its environment holds, so thread-pool requests run one at a time in the order made; plain vitest keeps the environment's value."
// The real `keel` binary runs `keel test` over a temp project (OS tmpdir); the control is plain vitest over the same project. Both children get `UV_THREADPOOL_SIZE=4` from this process's environment (the support's clean env keeps it). No generated inputs; seed n/a.
// ASSUMPTION: the property "whatever its environment holds" is exercised with the clause's `4` and with `128`, each a `keel test` run; the order is read from the record the test writes.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { keel, makeProject, plainVitest, removeFile, removeProject, summaryOf } from "./test-sim-project.ts";
import type { Run } from "./test-sim-project.ts";

const PROBE_TEST = `import { pbkdf2 } from "node:crypto";
import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";

it("records the pool size and the order four hashes answer in", async () => {
  const order: number[] = [];
  const hashes = [200_000, 1, 1, 1].map(
    (iterations, i) =>
      new Promise<void>((resolve, reject) => {
        pbkdf2("pw", "salt", iterations, 32, "sha256", (e) => {
          order.push(i);
          if (e === null) resolve();
          else reject(e);
        });
      }),
  );
  await Promise.all(hashes);
  writeFileSync(
    new URL("./observed.json", import.meta.url),
    JSON.stringify({ size: process.env.UV_THREADPOOL_SIZE ?? null, order }),
  );
  expect(order).toHaveLength(4);
});
`;

type Observed = { size: string | null; order: number[] };
const isObserved = (v: unknown): v is Observed =>
  typeof v === "object" && v !== null && "size" in v && "order" in v && Array.isArray(v.order);

let dir = "";
const read = (): Observed => {
  const v: unknown = JSON.parse(readFileSync(join(dir, "test", "observed.json"), "utf8"));
  if (!isObserved(v)) throw new Error("observed.json has no size");
  return v;
};

const viaKeel: { size: string; run: Run; saw: Observed }[] = [];
let controlSaw: Observed | undefined;
const before = process.env.UV_THREADPOOL_SIZE;

beforeAll(() => {
  dir = makeProject("test-pool", { "test/pool.test.ts": PROBE_TEST });
  for (const size of ["4", "128"]) {
    process.env.UV_THREADPOOL_SIZE = size;
    removeFile(dir, "test/observed.json");
    const run = keel(dir, ["test"]);
    viaKeel.push({ size, run, saw: read() });
  }
  process.env.UV_THREADPOOL_SIZE = "4";
  removeFile(dir, "test/observed.json");
  plainVitest(dir);
  controlSaw = read();
}, 240_000);

afterAll(() => {
  if (before === undefined) Reflect.deleteProperty(process.env, "UV_THREADPOOL_SIZE");
  else process.env.UV_THREADPOOL_SIZE = before;
  removeProject(dir);
});

describe("k.drive-law Order: `keel test` runs one thread-pool thread", () => {
  it("`keel test` runs the project's test and it passes", () => {
    for (const { run } of viaKeel) {
      expect(run.status).toBe(0);
      expect(summaryOf(run)).toMatchObject({ kind: "summary", ok: true, counts: { tests: 1, failed: 0 } });
    }
  });

  it("`keel test` starts the test's process with `UV_THREADPOOL_SIZE` `1`, whatever its environment holds: with `UV_THREADPOOL_SIZE=4` the test records `'1'`", () => {
    expect(viaKeel.find((v) => v.size === "4")?.saw.size).toBe("1");
  });

  it("whatever its environment holds, `keel test` records `'1'`: with `UV_THREADPOOL_SIZE=128` too", () => {
    expect(viaKeel.find((v) => v.size === "128")?.saw.size).toBe("1");
  });

  it("four `pbkdf2` calls made at once, the first of 200,000 iterations and the others of 1, answer in submission order under `keel test`: `[0, 1, 2, 3]`, for each environment value", () => {
    for (const { saw } of viaKeel) expect(saw.order).toEqual([0, 1, 2, 3]);
  });

  it("control: plain vitest over the same project with `UV_THREADPOOL_SIZE=4` records `'4'`", () => {
    expect(controlSaw?.size).toBe("4");
  });
});
