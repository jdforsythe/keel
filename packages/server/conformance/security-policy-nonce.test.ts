// Spec: k.security, Conformance "A production document carries the policy above, and its nonce equals the `nonce` of its module script and of `<meta property="csp-nonce">`; two documents under one sim ctx carry different 64-character nonces."
// Seed: 1337.
// @vitest-environment happy-dom
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import type { RouteProps } from "@keel/router";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

type Component = (props: RouteProps) => Node;

const COUNTER = `import { signal } from "@keel/reactive";
export default function Counter() {
  const n = signal(0);
  return <div><button id="c.inc" onClick={() => n.set(n.get() + 1)}>+</button><span id="c.out">{n.get()}</span></div>
}
`;

function compileComponent(source: string): Component {
  const r = compile([{ path: "Counter.tsx", source }]);
  expect(r.diagnostics).toEqual([]);
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

const DIRECTIVES = (nonce: string): string[] => [
  "default-src 'none'",
  `script-src 'nonce-${nonce}' 'strict-dynamic'`,
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "require-trusted-types-for 'script'",
  "trusted-types keel",
  "report-uri /__keel/csp",
  "report-to keel-csp",
];

const directivesOf = (policy: string): string[] =>
  policy
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d !== "");

const nonceOfPolicy = (policy: string): string => /'nonce-([^']+)'/.exec(policy)?.[1] ?? "";

async function setup(seed: number) {
  const routes = manifest({
    "app.counter": { path: "/counter", component: compileComponent(COUNTER) },
    "app.plain": { path: "/plain", component: () => document.createElement("main") },
  });
  const ctx = createCtx({ mode: "sim", seed });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
  });
  return { app, ctx };
}

const get = (app: { fetch(r: Request): Promise<Response> }, p: string): Promise<Response> =>
  app.fetch(new Request(`http://localhost${p}`));

describe("k.security: policy and nonce", () => {
  test("A production document carries the policy above", async () => {
    const { app } = await setup(1337);
    for (const p of ["/counter", "/plain"]) {
      const res = await get(app, p);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-security-policy-report-only")).toBeNull();
      const policy = res.headers.get("content-security-policy") ?? "";
      expect(directivesOf(policy)).toEqual(DIRECTIVES(nonceOfPolicy(policy)));
      expect(res.headers.get("reporting-endpoints")).toBe('keel-csp="/__keel/csp"');
    }
  });

  test('a production document\'s policy nonce equals the `nonce` of its module script and of `<meta property="csp-nonce">`', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 1_000_000 }), async (seed) => {
        const { app } = await setup(seed);
        const res = await get(app, "/counter");
        const nonce = nonceOfPolicy(res.headers.get("content-security-policy") ?? "");
        expect(nonce).not.toBe("");
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");
        expect(doc.querySelector('script[type="module"]')?.getAttribute("nonce")).toBe(nonce);
        expect(doc.querySelector('meta[property="csp-nonce"]')?.getAttribute("nonce")).toBe(nonce);
      }),
      { seed: 1337, numRuns: 10 },
    );
  });

  test("two documents under one sim ctx carry different 64-character nonces", async () => {
    const { app } = await setup(1337);
    const nonces: string[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await get(app, i % 2 === 0 ? "/counter" : "/plain");
      nonces.push(nonceOfPolicy(res.headers.get("content-security-policy") ?? ""));
    }
    for (const n of nonces) {
      expect(n).toHaveLength(64);
      expect(n).not.toContain("-");
    }
    expect(new Set(nonces).size).toBe(nonces.length);
  });
});
