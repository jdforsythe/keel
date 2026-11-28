// Spec: k.evaluator, clause "While `keel dev` serves a copy of `apps/household`, after it has answered a `GET /`, changing the path `/api/household` to `/api/home` in the contract file that holds it makes, within 2 s, `.keel/routes.json` byte-identical to what `keel build` of that tree writes; after a second answered `GET /`, changing it back does so again; and its output holds no `E1050`."
// Also states, k.cli, clause "While `keel dev` serves the copy of k.derived clause 1 after its edit, changing `app.about`'s path to `/info` in the contract file alone makes, within 2 s, `.keel/routes.json` and `.keel/surface.json` byte-identical to what `keel build` writes, and `GET /__keel/inspect` answer `routes` whose `app.about` has `path` `/info`." (here after requests a `node` deployable served, three edits in a row)
// Also states, k.evaluator End: "`keel dev` ends an evaluator whose bundle a newer change made stale and starts the next."
// Seed 1337 (recorded); no random inputs. One `keel dev` on a free port over a copy of apps/household, started in `beforeAll` and stopped (its process group, which this file spawned) in `afterAll`; the 2 s are counted on the monotonic clock from each write, polling the file's content every 25 ms (no fixed delay).
// Three edits to `modules/setup/setup.contract.ts` alone, each after `GET /`, `GET <the API path now in the contract>` (served by the `node` deployable) and `GET /__keel/inspect` were answered with any status: (1) `/api/household` to `/api/home` and the page `setup.form`'s path `/setup` to `/setup1`;
// (2) both back; (3) `/api/dwelling` and `/setup3`. The page path is edited too because `surface.json` holds API entries and the inspect document's `routes` holds page routes (k.compat Surface; the existing k.cli case asserts `routes`' `path`).
// ASSUMED (as dev-refresh-contract-alone.test.ts): the inspect document's `routes` holds an object keyed `setup.form` (at any depth) whose `path` is the route's path. "Answered" is any HTTP status.
import { fixedTime, testTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  type Tree,
  build,
  cloneTree,
  dropTree,
  householdTree,
  nap,
  nowMs,
  read,
  sub,
  views,
} from "./derived-support.ts";
import { type Dev, get, startDev } from "./evaluator-support.ts";

const SLOW = testTime(600_000);
const WITHIN = fixedTime(2_000);
const CONTRACT = "modules/setup/setup.contract.ts";

type Step = { api: string; page: string };
const ORIGINAL: Step = { api: "/api/household", page: "/setup" };
const STEPS: readonly Step[] = [
  { api: "/api/home", page: "/setup1" },
  ORIGINAL,
  { api: "/api/dwelling", page: "/setup3" },
];

/** Milliseconds after each edit at which each outcome first held; undefined when it never did within the wait. */
type Outcome = { routes?: number; surface?: number; inspect?: number; answered: boolean; statuses: string };
const outcomes: Outcome[] = [];
const made: Tree[] = [];
let dev: Dev | undefined;

/** The `path` of the first object keyed `id`, at any depth. */
function pathOf(node: unknown, id: string): unknown {
  if (typeof node !== "object" || node === null) return undefined;
  const direct: unknown = Reflect.get(node, id);
  if (typeof direct === "object" && direct !== null) return Reflect.get(direct, "path");
  for (const v of Object.values(node)) {
    const found = pathOf(v, id);
    if (found !== undefined) return found;
  }
  return undefined;
}

async function inspectPage(port: number): Promise<unknown> {
  const doc = await get(port, "/__keel/inspect");
  if (doc === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(doc.body);
    return typeof parsed === "object" && parsed !== null
      ? pathOf(Reflect.get(parsed, "routes"), "setup.form")
      : undefined;
  } catch {
    return undefined;
  }
}

const edit = (dir: string, from: Step, to: Step): void => {
  sub(dir, CONTRACT, `path: "${from.api}"`, `path: "${to.api}"`);
  sub(dir, CONTRACT, `path: "${from.page}"`, `path: "${to.page}"`);
};

beforeAll(async () => {
  const house = householdTree();
  made.push(house);
  const served = cloneTree(house);
  made.push(served);
  const want: Record<string, string>[] = [];
  for (const step of STEPS) {
    if (step === ORIGINAL) {
      want.push(views(house.dir));
      continue;
    }
    const control = cloneTree(house);
    made.push(control);
    edit(control.dir, ORIGINAL, step);
    build(control.dir);
    want.push(views(control.dir));
  }
  dev = await startDev(served.dir, 120_000);
  let at: Step = ORIGINAL;
  for (const [i, step] of STEPS.entries()) {
    const answered = [await get(dev.port, "/"), await get(dev.port, at.api), await get(dev.port, "/__keel/inspect")];
    const wanted = want[i] ?? {};
    const out: Outcome = {
      answered: answered.every((a) => a !== undefined),
      statuses: answered.map((a) => String(a?.status)).join(","),
    };
    edit(served.dir, at, step);
    at = step;
    const start = nowMs();
    while (nowMs() - start < WITHIN) {
      const now = Math.round(nowMs() - start);
      const have = views(served.dir);
      if (out.routes === undefined && have[".keel/routes.json"] === wanted[".keel/routes.json"]) out.routes = now;
      if (out.surface === undefined && have[".keel/surface.json"] === wanted[".keel/surface.json"]) out.surface = now;
      if (out.inspect === undefined && (await inspectPage(dev.port)) === step.page) out.inspect = now;
      if (out.routes !== undefined && out.surface !== undefined && out.inspect !== undefined) break;
      nap(25);
    }
    expect(read(served.dir, CONTRACT)).toContain(`"${step.api}"`);
    outcomes.push(out);
  }
}, SLOW);

afterAll(async () => {
  await dev?.stop();
  for (const t of made) dropTree(t);
});

describe("k.evaluator: `keel dev` refreshes on a contract file alone, after requests a `node` deployable served", () => {
  test("while `keel dev` serves a copy of `apps/household`, after it has answered a `GET /`, changing the path `/api/household` to `/api/home` in the contract file that holds it makes, within 2 s, `.keel/routes.json` byte-identical to what `keel build` of that tree writes", () => {
    expect(
      outcomes[0]?.answered,
      `the requests were answered (statuses ${outcomes[0]?.statuses}; exit ${String(dev?.child.exitCode)}; output ${dev?.output().slice(-600)})`,
    ).toBe(true);
    expect(outcomes[0]?.routes, "ms until routes.json matched").toBeLessThanOrEqual(2_000);
  });

  test("after a second answered `GET /`, changing it back makes, within 2 s, `.keel/routes.json` byte-identical to what `keel build` of that tree writes again", () => {
    expect(outcomes[1]?.answered).toBe(true);
    expect(outcomes[1]?.routes, "ms until routes.json matched").toBeLessThanOrEqual(2_000);
  });

  test("a third edit, after a third answered request, makes, within 2 s, `.keel/routes.json` byte-identical to what `keel build` of that tree writes", () => {
    expect(outcomes[2]?.answered).toBe(true);
    expect(outcomes[2]?.routes, "ms until routes.json matched").toBeLessThanOrEqual(2_000);
  });

  test.each([[0], [1], [2]])(
    "after request %i, an edit to the contract file alone makes, within 2 s, `.keel/surface.json` byte-identical to what `keel build` of that tree writes",
    (i) => {
      expect(outcomes[i]?.surface, "ms until surface.json matched").toBeLessThanOrEqual(2_000);
    },
  );

  test.each([[0], [1], [2]])(
    "after request %i, an edit to the contract file alone makes `GET /__keel/inspect` answer `routes` whose `setup.form` has the new `path`, within 2 s",
    (i) => {
      expect(outcomes[i]?.inspect, "ms until the inspect document held the new path").toBeLessThanOrEqual(2_000);
    },
  );

  test("its output holds no `E1050`", () => {
    expect(dev?.output() ?? "E1050 (no dev server)").not.toContain("E1050");
  });
});
