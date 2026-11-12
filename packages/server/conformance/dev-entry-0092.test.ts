// @vitest-environment happy-dom
// Spec: k.server, clause "With a `client` and a `node` deployable in dev, the `node` one's island document scripts `/@keel/entry.ts?d=<name>`, which resumes its islands."
// Seed 1337 (fc.assert below). Real compiled TSX, in-process createApp in dev mode; pattern of resume-entry.test.ts.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { manifest } from "@keel/router";
import type { RouteProps } from "@keel/router";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { topology } from "@keel/server";
import { SEED, createAppLoose, simCtx } from "./topology-fixtures.ts";

const COUNTER = `import { signal } from "@keel/reactive";
export default function Counter() {
  const n = signal(0);
  return <div><button id="c.inc" onClick={() => n.set(n.get() + 1)}>+</button><span id="c.out">{n.get()}</span></div>
}
`;

function counter(): (props: RouteProps) => Node {
  const r = compile([{ path: "Counter.tsx", source: COUNTER }]);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code);
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  return (props) => {
    const node: unknown = fn(props);
    if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
    return node;
  };
}

describe("k.server: dev entry per node deployable", () => {
  test("With a `client` and a `node` deployable in dev, the `node` one's island document scripts `/@keel/entry.ts?d=<name>`, which resumes its islands.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("web", "api", "shop", "back-end"), async (name) => {
        const t = topology({
          ui: { modules: ["site"], adapter: "client" },
          [name]: { modules: ["app"], adapter: "node" },
        });
        const app = await createAppLoose({
          topology: t,
          deployable: name,
          routes: manifest({ "app.page": { path: "/page", component: counter() } }),
          ctx: simCtx(),
          mode: "dev",
        });
        const res = await app.fetch(new Request("http://localhost/page"));
        expect(res.status).toBe(200);
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");
        const scripts = doc.querySelectorAll('script[type="module"]');
        expect(scripts).toHaveLength(1);
        const src = scripts[0]?.getAttribute("src");
        expect(src).toBe(`/@keel/entry.ts?d=${name}`);
        const entry = await app.fetch(new Request(new URL(src ?? "", "http://localhost")));
        expect(entry.status).toBe(200);
        expect(entry.headers.get("content-type") ?? "").toContain("javascript");
        const body = await entry.text();
        expect(body).toContain("resume(");
        expect(body).toContain(`/@keel/islands.ts?d=${name}`);
      }),
      { seed: SEED, numRuns: 4 },
    );
  });
});
