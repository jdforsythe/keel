// @vitest-environment happy-dom
// Spec: k.resume, clause "Islands resume in document order: an `effect` in each records its route id, layout before page."
// Seed: 1337 (fc.assert seed below). Real compiled TSX, real createApp, real resume.
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Level, SEED, componentsOf, install, resumeBody, serve } from "./resume-app.ts";

let order: string[] = [];

beforeEach(() => {
  order = [];
  Reflect.set(globalThis, "keelOrder", order);
});

afterEach(() => {
  document.body.innerHTML = "";
  Reflect.deleteProperty(globalThis, "keelOrder");
});

const recording = (id: string, island: boolean): string => `import { effect } from "@keel/reactive";
export default function C(props) {
  ${island ? `effect(() => { globalThis.keelOrder.push("${id}"); });` : ""}
  return <div id="${id}.root"><h3>{props.data.title}</h3>{props.children()}</div>
}
`;

const pageOf = (id: string, island: boolean): string => `import { effect } from "@keel/reactive";
export default function P(props) {
  ${island ? `effect(() => { globalThis.keelOrder.push("${id}"); });` : ""}
  return <div id="${id}.root"><h3>{props.data.title}</h3></div>
}
`;

describe("k.resume: islands resume in document order", () => {
  it("an effect in each records its route id, layout before page", async () => {
    const levels: Level[] = [
      { id: "do1.layout", source: recording("do1.layout", true), title: "l" },
      { id: "do1.page", source: pageOf("do1.page", true), path: "/order", layout: "do1.layout", title: "p" },
    ];
    install(await serve(levels, "/order"));
    expect(document.querySelectorAll("[data-k-island]")).toHaveLength(2);
    order.length = 0;
    const { warnings } = resumeBody(componentsOf(levels));
    expect(warnings).toEqual([]);
    expect(order).toEqual(["do1.layout", "do1.page"]);
  });

  it(
    "property (seed 1337): over chains of island and static layouts around an island page, the effects record the island route ids in document order",
    async () => {
      const chain = fc.array(fc.boolean(), { minLength: 1, maxLength: 3 });
      let run = 0;
      await fc.assert(
        fc.asyncProperty(chain, async (kinds) => {
          run++;
          document.body.innerHTML = "";
          const layouts: Level[] = kinds.map((island, i) => ({
            id: `dp${run}x${i}.layout`,
            source: recording(`dp${run}x${i}.layout`, island),
            title: `l${i}`,
            ...(i === 0 ? {} : { layout: `dp${run}x${i - 1}.layout` }),
          }));
          const page: Level = {
            id: `dp${run}.page`,
            source: pageOf(`dp${run}.page`, true),
            path: "/chain",
            layout: `dp${run}x${kinds.length - 1}.layout`,
            title: "p",
          };
          const levels = [...layouts, page];
          install(await serve(levels, "/chain"));
          order.length = 0;
          const { warnings } = resumeBody(componentsOf(levels));
          expect(warnings).toEqual([]);
          const inDocument = [...document.querySelectorAll("[data-k-island]")].map((e) =>
            e.getAttribute("data-k-island"),
          );
          expect(order).toEqual(inDocument);
          expect(order[order.length - 1]).toBe(`dp${run}.page`);
        }),
        { seed: SEED, numRuns: 12 },
      );
    },
    fixedTime(120_000),
  );
});
