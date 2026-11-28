// @vitest-environment happy-dom
// k.leave, Restore "At resume, a snapshot its store refuses (`restore` returns `err`), whether the store is in `stores` or an island creates it, is the warning `E1253 #k-state snapshot for store "<id>" does not restore`; the store keeps its initial state."
// Spec: k.leave, clause "A store in `stores`, and one an island creates, each given a `#k-state` snapshot its schema refuses: `resume` warns E1253 for each and each keeps its initial state."
// Seed: 1337 (the property below). Hand-built compiled islands, as fixtures.ts does; ids are made fresh for each run.
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { clone, resume, template, text } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { store } from "@keel/store";
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SEED } from "./fixtures.ts";
const simCtx = createCtx({ mode: "sim", seed: 1337 });

const Count = s.object({ n: s.int() });
const HTML = '<div data-k-island="Late"><b data-k="out">0</b></div>';
const Tpl = template(HTML);

let serial = 0;
const fresh = (): { known: string; late: string } => {
  serial += 1;
  return { known: `leave.known${serial}`, late: `leave.late${serial}` };
};

afterEach(() => {
  document.body.innerHTML = "";
});

const messageOf = (w: unknown): string => {
  if (typeof w === "string") return w;
  if (w instanceof Error) return w.message;
  const m: unknown = typeof w === "object" && w !== null ? Reflect.get(w, "message") : undefined;
  return typeof m === "string" ? m : JSON.stringify(w);
};

type Outcome = { readonly warnings: string[]; readonly known: number; readonly late: number };

/** Resumes an island that creates `late` with the given snapshots waiting; `known` is in `stores`. */
function run(ids: { known: string; late: string }, knownSnap: unknown, lateSnap: unknown): Outcome {
  let known: ReturnType<typeof store<{ n: number }>> | undefined;
  scope(
    () => {
      known = store(Count, { n: 0 }, { id: ids.known });
    },
    { detached: true },
  );
  if (known === undefined) throw new Error("fixture: no store");
  let late: ReturnType<typeof store<{ n: number }>> | undefined;
  const Late = (): Node => {
    const root = clone(Tpl);
    late = store(Count, { n: 0 }, { id: ids.late });
    const made = late;
    const out = root.querySelector("b");
    if (out !== null) text(out, () => String(made.get("n")));
    return root;
  };
  document.body.innerHTML = `${HTML}<script type="application/json" id="k-state">${JSON.stringify({
    stores: { [ids.known]: knownSnap, [ids.late]: lateSnap },
    islands: { Late: {} },
  })}</script>`;
  const seen: string[] = [];
  const spy = vi
    .spyOn(console, "warn")
    .mockImplementation((...a: unknown[]) => void seen.push(a.map(String).join(" ")));
  try {
    const { warnings } = resume(document.body, { Late }, { stores: { [ids.known]: known }, mode: "dev", ctx: simCtx });
    const all = [...warnings.map(messageOf), ...seen];
    return { warnings: all, known: known.get("n"), late: late === undefined ? Number.NaN : late.get("n") };
  } finally {
    spy.mockRestore();
  }
}

const refusedKnown = { state: { n: "seven" }, log: [], initial: { n: 7 } };
const refusedLate = { state: { n: -1.5 }, log: [] };

describe("k.leave Restore: a snapshot its store refuses is a warning and the store keeps its initial state", () => {
  it("`known` in `stores` and `late` created by the island, each given a snapshot the schema refuses: resume warns E1253 for each, and each store holds its initial state", () => {
    const ids = fresh();
    const r = run(ids, refusedKnown, refusedLate);
    expect(
      r.warnings.some((w) => w.includes(`E1253 #k-state snapshot for store "${ids.known}" does not restore`)),
    ).toBe(true);
    expect(r.warnings.some((w) => w.includes(`E1253 #k-state snapshot for store "${ids.late}" does not restore`))).toBe(
      true,
    );
    expect(r.known).toBe(0);
    expect(r.late).toBe(0);
  });

  it("negative: a snapshot each schema accepts warns nothing", () => {
    const ids = fresh();
    const ok = { state: { n: 0 }, log: [], initial: { n: 0 } };
    const r = run(ids, ok, ok);
    expect(r.warnings.filter((w) => w.includes("E1253"))).toEqual([]);
  });

  it("property: for any state the schema refuses, the warning names the store and the store keeps its initial state", () => {
    const refused = fc.oneof(
      fc.double({ noNaN: true, noDefaultInfinity: true }).filter((x) => !Number.isInteger(x)),
      fc.stringMatching(/^[a-z]{1,6}$/),
      fc.boolean(),
    );
    fc.assert(
      fc.property(refused, refused, (a, b) => {
        document.body.innerHTML = "";
        const ids = fresh();
        const r = run(ids, { state: { n: a }, log: [], initial: { n: 0 } }, { state: { n: b }, log: [] });
        expect(
          r.warnings.some((w) => w.includes(`E1253 #k-state snapshot for store "${ids.known}" does not restore`)),
        ).toBe(true);
        expect(
          r.warnings.some((w) => w.includes(`E1253 #k-state snapshot for store "${ids.late}" does not restore`)),
        ).toBe(true);
        expect(r.known).toBe(0);
        expect(r.late).toBe(0);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
