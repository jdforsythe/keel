// @vitest-environment happy-dom
// k.resume, Replay "Events queued before resume replay once all islands resume, in fired order, each as a live one: from the target through each enclosing island, until `stopPropagation`; one in a re-rendered island's own nodes is dropped."
// Spec: k.resume, clause "Clicks queued on a page island's button, then its layout island's, replay after both resume, page first; a layout handler on an element enclosing the page's button runs after the page's, unless the page's calls `stopPropagation`."
// Property seed: 1337 (fc.assert seed below). A chain of one to four island levels, a random sequence of clicks fired before resume:
// the handlers run in fired order, each click through the handler of its button, then each enclosing level's wrapper, innermost first.
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { type Component, type Level, componentsOf, install, serve } from "./resume-app.ts";
import { clickNow, recording, replayLayout, replayPage, resumeObserved } from "./resume-replay-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

/** `depth` levels: layouts `r0` to `r<depth-2>` nested outermost first, then the page `r<depth-1>`. */
function chain(depth: number): readonly Level[] {
  const out: Level[] = [];
  for (let i = 0; i < depth; i++) {
    const last = i === depth - 1;
    const layout = i === 0 ? {} : { layout: `r${i - 1}.layout` };
    out.push(
      last
        ? { id: `r${i}.page`, source: replayPage(`r${i}`), path: "/chain", ...layout }
        : { id: `r${i}.layout`, source: replayLayout(`r${i}`), ...layout },
    );
  }
  return out;
}

/** What a live click on level `k`'s button runs: its own handler, then each enclosing level's wrapper, innermost first. */
function live(k: number): string[] {
  const out = [`r${k}.btn`];
  for (let j = k - 1; j >= 0; j--) out.push(`r${j}.wrap`);
  return out;
}

const scenario = fc
  .integer({ min: 1, max: 4 })
  .chain((depth) =>
    fc.tuple(fc.constant(depth), fc.array(fc.integer({ min: 0, max: depth - 1 }), { minLength: 1, maxLength: 8 })),
  );

describe("k.resume: queued events replay in fired order, each through its enclosing islands, over random island chains", () => {
  it(
    "property: for any island chain and any sequence of queued clicks, handlers run in fired order, each click through its button and every enclosing wrapper",
    async () => {
      await fc.assert(
        fc.asyncProperty(scenario, async ([depth, targets]) => {
          document.body.innerHTML = "";
          const levels = chain(depth);
          install(await serve(levels, "/chain"));
          for (const t of targets) clickNow(`r${t}.btn`);
          const log: string[] = [];
          const components: Record<string, Component> = {};
          for (const [id, c] of Object.entries(componentsOf(levels))) components[id] = recording(c, log);
          const { warnings } = resumeObserved(components);
          expect(warnings).toEqual([]);
          expect(log.filter((id) => !id.endsWith(".built"))).toEqual(targets.flatMap(live));
          const firstReplayed = log.findIndex((id) => !id.endsWith(".built"));
          expect(log.slice(0, firstReplayed)).toHaveLength(depth);
        }),
        { seed: 1337, numRuns: 25 },
      );
    },
    fixedTime(120_000),
  );
});
