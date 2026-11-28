// @vitest-environment happy-dom
// Spec: k.resume, clause "For every route of a test app, the body of the document `createApp` serves, resumed with the app's compiled components by route id and its stores, returns no warning, keeps every server node, and a handler fired on a server element runs and updates the bindings it writes."
// Seed: 1337 (fc.assert seed below). Generated trees of layout, static and island levels and structural ops; real compiled TSX, real createApp, real resume.
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Level,
  SEED,
  click,
  componentsOf,
  elementsOf,
  expectKept,
  expectText,
  install,
  islandLayout,
  resumeBody,
  serve,
  staticLayout,
} from "./resume-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

type Op =
  | { readonly k: "text" }
  | { readonly k: "if"; readonly on: boolean; readonly kids: readonly Op[] }
  | { readonly k: "for"; readonly rows: number; readonly empty: boolean; readonly kids: readonly Op[] }
  | { readonly k: "match"; readonly tag: "a" | "b"; readonly a: readonly Op[]; readonly b: readonly Op[] }
  | { readonly k: "boundary"; readonly kids: readonly Op[] };

const ops: fc.Arbitrary<Op> = fc.letrec<{ op: Op }>((tie) => {
  const kids = fc.array(tie("op"), { maxLength: 2 });
  return {
    op: fc.oneof(
      { depthSize: "small", withCrossShrink: true },
      fc.constant<Op>({ k: "text" }),
      fc.record({ k: fc.constant("if" as const), on: fc.boolean(), kids }),
      fc.record({ k: fc.constant("for" as const), rows: fc.integer({ min: 0, max: 3 }), empty: fc.boolean(), kids }),
      fc.record({
        k: fc.constant("match" as const),
        tag: fc.constantFrom("a" as const, "b" as const),
        a: kids,
        b: kids,
      }),
      fc.record({ k: fc.constant("boundary" as const), kids }),
    ),
  };
}).op;

const render = (op: Op): string => {
  const all = (kids: readonly Op[]): string => `<div>${kids.map(render).join("")}</div>`;
  switch (op.k) {
    case "text":
      return `<span class="t">t</span>`;
    case "if":
      return `<If when={${op.on ? "T" : "F"}.get()}>${all(op.kids)}</If>`;
    case "for": {
      const empty = op.empty ? ` empty={() => <li class="none">none</li>}` : "";
      return `<ul><For each={R${op.rows}.get()} key="id"${empty}>{(r) => <li class="row"><span>{r.id}</span>${op.kids.map(render).join("")}</li>}</For></ul>`;
    }
    case "match":
      return `<Match on={M${op.tag}.get()}><Case tag="a">${all(op.a)}</Case><Case tag="b">${all(op.b)}</Case></Match>`;
    case "boundary":
      return `<Boundary fallback={() => <p>err</p>}>${all(op.kids)}</Boundary>`;
  }
};

const pageSource = (
  k: string,
  island: boolean,
  body: readonly Op[],
): string => `import { signal } from "@keel/reactive";
import { Boundary, Case, For, If, Match } from "@keel/runtime-dom";
const T = signal(true);
const F = signal(false);
const Ma = signal({ tag: "a" });
const Mb = signal({ tag: "b" });
const R0 = signal([]);
const R1 = signal([{ id: "a" }]);
const R2 = signal([{ id: "a" }, { id: "b" }]);
const R3 = signal([{ id: "a" }, { id: "b" }, { id: "c" }]);
export default function Page(props) {
  const n = signal(0);
  return <div id="${k}.root">${
    island
      ? `<button id="${k}.inc" onClick={() => n.set(n.get() + 1)}>+</button><span id="${k}.out">{n.get()}</span>`
      : ""
  }${body.map(render).join("")}</div>
}
`;

describe("k.resume: served documents resume", () => {
  it(
    "property (seed 1337): a generated tree of layout, static and island levels and structural ops resumes with no warning, keeping every server node, and each handler runs once per event",
    async () => {
      let run = 0;
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.boolean(), { maxLength: 2 }),
          fc.boolean(),
          fc.array(ops, { maxLength: 3 }),
          async (layoutKinds, pageIsland, body) => {
            run++;
            document.body.innerHTML = "";
            const levels: Level[] = layoutKinds.map((island, i) => ({
              id: `pr${run}l${i}.layout`,
              source: island ? islandLayout(`pr${run}l${i}`) : staticLayout(`pr${run}l${i}`),
              title: `layout ${i}`,
              ...(i === 0 ? {} : { layout: `pr${run}l${i - 1}.layout` }),
            }));
            levels.push({
              id: `pr${run}p.page`,
              source: pageSource(`pr${run}p`, pageIsland, body),
              path: "/gen",
              title: "page",
              ...(layoutKinds.length === 0 ? {} : { layout: `pr${run}l${layoutKinds.length - 1}.layout` }),
            });
            const doc = await serve(levels, "/gen");
            expect(doc.status).toBe(200);
            install(doc);
            const before = elementsOf(document.body);
            const { warnings, console: logged } = resumeBody(componentsOf(levels));
            expect(warnings).toEqual([]);
            expect(logged).toEqual([]);
            expectKept(before);
            const counters = [
              ...layoutKinds.flatMap((island, i) => (island ? [`pr${run}l${i}`] : [])),
              ...(pageIsland ? [`pr${run}p`] : []),
            ];
            for (const k of counters) {
              await click(`${k}.inc`);
              expectText(`${k}.out`, "1");
            }
            for (const el of before) expect(el.isConnected).toBe(true);
          },
        ),
        { seed: SEED, numRuns: 20 },
      );
    },
    fixedTime(240_000),
  );
});

it("the generator reaches every structural op", () => {
  const seen = new Set<string>();
  const visit = (op: Op): void => {
    seen.add(op.k);
    if (op.k === "match") [...op.a, ...op.b].forEach(visit);
    else if (op.k !== "text") op.kids.forEach(visit);
  };
  fc.assert(
    fc.property(fc.array(ops, { maxLength: 3 }), (xs) => {
      xs.forEach(visit);
    }),
    { seed: SEED, numRuns: 200 },
  );
  expect([...seen].sort()).toEqual(["boundary", "for", "if", "match", "text"]);
});
